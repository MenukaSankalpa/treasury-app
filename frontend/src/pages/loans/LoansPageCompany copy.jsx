import { useState, useMemo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BANKS, LOAN_TYPES, CURRENCIES, REPAY_FREQ } from "../../constants";
import { fmtM, fmtFull, fmtPct, wtdRate, genAmort, fmt, TODAY, suggestRepayAmount } from "../../utils";
import { GlassCard, KpiGlass, Badge, Table, Modal, Field, FormRow, PageHeader, S } from "../../components/UI";
import { loansApi } from "../../api/treasury";
import { usersApi } from "../../api/users";
import { USE_MOCK } from "../../config";
import { MOCK_USERS } from "../../mockUsers";
import { usePermissions } from "../../context/PermissionsContext";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationsContext";
import { useAudit } from "../../context/AuditContext";
import FileUpload from "../../components/FileUpload";
import { sendActionEmail, findUser } from "../../lib/emailService";

async function loadUsers() {
  if (USE_MOCK) return MOCK_USERS.map(({password, ...u}) => u);
  try { return await usersApi.list(); } catch { return []; }
}

function ActionBox({label, children}) {
  return (
    <div style={{background:"var(--color-background-info)",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,padding:"12px 14px",marginTop:8}}>
      <div style={{fontSize:13,fontWeight:600,color:"var(--color-text-info)",marginBottom:8}}>{label}</div>
      <div style={{display:"flex",gap:8}}>{children}</div>
    </div>
  );
}

export default function LoansPageCompany({loans, setLoans}) {
  const { user } = useAuth();
  const { canDoAction } = usePermissions();
  const { notify } = useNotifications();
  const { logAction } = useAudit();

  // Only Team Member originates a facility request — Accountant reviews, never adds.
  const canAdd = canDoAction(user, "add_facility") && user.role === "TeamMember";
  const canAccountantReview = user.role === "Accountant";
  const canCompanyHeadDecide = user.role === "CompanyHead";

  const [modal, setModal] = useState(null); // "form" | loan object | "sens"
  const [filterIT, setFilterIT] = useState("");
  const blank = {company:user.company,type:"",bank:"",bankAccountNo:"",currency:"LKR",facilityAmt:"",outstanding:"",interestType:"Fixed",rate:"",spread:"",awplr:"10.0",facilityDate:"",maturityDate:"",repayFreq:"Monthly",repayAmt:"",security:"",purpose:"",attachments:[]};
  const [form, setForm] = useState(blank);
  const [repayTouched, setRepayTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const myLoans = useMemo(() => loans.filter(l => l.company === user.company), [loans, user.company]);
  const filtered = myLoans.filter(l => !filterIT || l.interestType === filterIT);
  const activeFiltered = filtered.filter(l => (l.status || "Active") === "Active");

  const totalDebt = activeFiltered.reduce((s,l)=>s+l.outstanding,0);
  const fixedDebt = activeFiltered.filter(l=>l.interestType==="Fixed").reduce((s,l)=>s+l.outstanding,0);
  const varDebt = activeFiltered.filter(l=>l.interestType!=="Fixed").reduce((s,l)=>s+l.outstanding,0);
  const avg = wtdRate(activeFiltered);
  const pendingAccountantCount = filtered.filter(l=>l.status==="Pending Accountant Review").length;
  const pendingHeadCount = filtered.filter(l=>l.status==="Pending Company Head").length;
  const pendingTreasuryCount = filtered.filter(l=>l.status==="Pending Treasury Approval").length;

  const sensData = [-2,-1,0,1,2].map(d => {
    const base = 10.0 + d;
    const ann = activeFiltered.reduce((s,l) => {
      const r = l.interestType==="Fixed" ? l.rate : (l.spread + base);
      return s + l.outstanding * r / 100;
    },0);
    return {label:d===0?"Base (10%)":`${d>0?"+":""}${d}%`,annual:Math.round(ann/1e6),d};
  });

  const updateFormField = (patch) => {
    const next = {...form, ...patch};
    const drivingFieldsChanged = "facilityAmt" in patch || "facilityDate" in patch || "maturityDate" in patch || "repayFreq" in patch;
    if (drivingFieldsChanged && !repayTouched) {
      next.repayAmt = String(suggestRepayAmount(next.facilityAmt, next.facilityDate, next.maturityDate, next.repayFreq) || "");
    }
    setForm(next);
  };

  // ── 1. Team Member submits → goes to Accountant first ──
  const save = async () => {
    setSaving(true);
    try {
      const payload = {...form, company:user.company, facilityAmt:+form.facilityAmt, outstanding:+form.outstanding, rate:+form.rate, spread:+form.spread||0, awplr:+form.awplr||0, repayAmt:+form.repayAmt||0};
      const newLoan = {
        ...payload, id:"L"+Date.now(), status:"Pending Accountant Review", cashBacked:false,
        requestedBy:user.name, requestedByEmail:user.email, editHistory:[],
      };

      if (USE_MOCK) {
        setLoans([...loans, newLoan]);
      } else {
        const created = await loansApi.create(payload);
        setLoans([...loans, {...created, status:"Pending Accountant Review", requestedBy:user.name, requestedByEmail:user.email, attachments:form.attachments, editHistory:[]}]);
      }

      notify({
        title:"New facility needs Accountant review",
        message:`${payload.company} — ${fmtFull(payload.outstanding)} at ${payload.bank} needs Accountant review`,
        targetRoles:["Accountant"], entityId:newLoan.id,
      });
      logAction({user, action:"Added loan facility", entityType:"Loan", entityId:newLoan.id, details:`${payload.company} — ${fmtFull(payload.outstanding)} at ${payload.bank}`});

      const users = await loadUsers();
      const accountant = findUser(users, "Accountant", user.company);
      await sendActionEmail({
        toEmail: accountant?.email, toName: accountant?.name || "Accountant",
        message: `A new facility request (${payload.bank} — ${fmtFull(payload.outstanding)}) needs your review.`,
        loanRef: newLoan.id, borrower: user.company, amount: fmtFull(payload.outstanding),
      });

      setModal(null); setForm(blank); setRepayTouched(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── 2. Accountant reviews (new step) ──
  const accountantDecide = async (loan, action, reason="") => {
    setActing(true);
    try {
      let updated;
      if (USE_MOCK) {
        const newStatus = action === "approve" ? "Pending Company Head" : "Rejected";
        updated = {...loan, status:newStatus, accountantDecidedBy:user.name, accountantDecidedDate:fmt(TODAY), rejectReason: action==="reject"?reason:undefined};
      } else {
        updated = await loansApi.accountantDecide(loan.id, action, reason);
      }
      setLoans(loans.map(l => l.id===loan.id ? updated : l));
      notify({
        title: action === "approve" ? "Approved — sent to Company Head" : "Facility request rejected",
        message: action === "approve"
          ? `${loan.company} facility at ${loan.bank} approved by Accountant, now awaiting Company Head`
          : `${loan.company} facility at ${loan.bank} was rejected by Accountant`,
        targetRoles: action === "approve" ? ["CompanyHead"] : [],
        targetEmails: loan.requestedByEmail ? [loan.requestedByEmail] : [],
        entityId: loan.id,
      });
      logAction({user, action:`Accountant ${action}d loan facility`, entityType:"Loan", entityId:loan.id, details:`${loan.company} — ${fmtFull(loan.outstanding)} at ${loan.bank}`});

      const users = await loadUsers();
      if (action === "approve") {
        const head = findUser(users, "CompanyHead", loan.company);
        await sendActionEmail({
          toEmail: head?.email, toName: head?.name || "Company Head",
          message: `${loan.company} facility at ${loan.bank} approved by Accountant — needs your approval.`,
          loanRef: loan.id, borrower: loan.company, amount: fmtFull(loan.outstanding),
        });
      } else {
        await sendActionEmail({
          toEmail: loan.requestedByEmail, toName: loan.requestedBy,
          message: `Your facility request at ${loan.bank} was rejected by Accountant. Reason: ${reason}`,
          loanRef: loan.id, borrower: loan.company, amount: fmtFull(loan.outstanding),
        });
      }
      setModal(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  // ── 3. Company Head approves/rejects (unchanged logic, third step) ──
  const companyHeadDecide = async (loan, action, reason="") => {
    setActing(true);
    try {
      let updated;
      if (USE_MOCK) {
        const newStatus = action === "approve" ? "Pending Treasury Approval" : "Rejected";
        updated = {...loan, status:newStatus, companyHeadDecidedBy:user.name, companyHeadDecidedDate:fmt(TODAY), rejectReason: action==="reject"?reason:undefined};
      } else {
        updated = await loansApi.companyHeadDecide(loan.id, action, reason);
      }
      setLoans(loans.map(l => l.id===loan.id ? updated : l));
      notify({
        title: action === "approve" ? "Approved — sent to Treasury" : "Facility request rejected",
        message: action === "approve"
          ? `${loan.company} facility at ${loan.bank} (${fmtFull(loan.outstanding)}) approved by Company Head, now awaiting Treasury`
          : `${loan.company} facility at ${loan.bank} was rejected by Company Head`,
        targetRoles: action === "approve" ? ["Treasury"] : [],
        targetEmails: loan.requestedByEmail ? [loan.requestedByEmail] : [],
        entityId: loan.id,
      });
      logAction({user, action:`Company Head ${action}d loan facility`, entityType:"Loan", entityId:loan.id, details:`${loan.company} — ${fmtFull(loan.outstanding)} at ${loan.bank}`});

      const users = await loadUsers();
      if (action === "approve") {
        const treasury = findUser(users, "Treasury");
        await sendActionEmail({
          toEmail: treasury?.email, toName: treasury?.name || "Treasury",
          message: `${loan.company} facility at ${loan.bank} approved by Company Head — needs Treasury review.`,
          loanRef: loan.id, borrower: loan.company, amount: fmtFull(loan.outstanding),
        });
      } else {
        await sendActionEmail({
          toEmail: loan.requestedByEmail, toName: loan.requestedBy,
          message: `Your facility request at ${loan.bank} was rejected by Company Head. Reason: ${reason}`,
          loanRef: loan.id, borrower: loan.company, amount: fmtFull(loan.outstanding),
        });
      }
      setModal(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  const selectStyle = {padding:"6px 10px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",fontSize:13,background:"var(--color-background-primary)",color:"var(--color-text-primary)"};
  const statusBadge = (s) => s==="Active"?"green":s==="Rejected"?"red":s==="Pending Accountant Review"?"blue":s==="Pending Company Head"?"blue":"amber";

  return (
    <div>
      <PageHeader title={`Loans & Borrowings — ${user.company}`}>
        <button style={S.btnGhost} onClick={() => setModal("sens")}>AWPLR sensitivity</button>
        {canAdd && (
          <button style={S.btn("#185FA5")} onClick={() => { setForm({...blank, company:user.company}); setRepayTouched(false); setModal("form"); }}>
            + Add facility
          </button>
        )}
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
        <KpiGlass label="Total outstanding" value={fmtM(totalDebt)} accent="#A32D2D" icon="ti-credit-card" />
        <KpiGlass label="Fixed rate debt" value={fmtM(fixedDebt)} sub={totalDebt ? `${((fixedDebt/totalDebt)*100).toFixed(0)}% of total` : ""} accent="#534AB7" icon="ti-lock" />
        <KpiGlass label="Variable rate debt" value={fmtM(varDebt)} sub={totalDebt ? `${((varDebt/totalDebt)*100).toFixed(0)}% of total` : ""} accent="#BA7517" icon="ti-trending-up" />
        <KpiGlass label="Pending Accountant" value={pendingAccountantCount} accent="#993556" icon="ti-user-check" />
        <KpiGlass label="Pending Company Head" value={pendingHeadCount} accent="#185FA5" icon="ti-user-check" />
        <KpiGlass label="Pending Treasury" value={pendingTreasuryCount} accent="#0F6E56" icon="ti-clock" />
      </div>

      <GlassCard style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <select value={filterIT} onChange={(e) => setFilterIT(e.target.value)} style={selectStyle}>
            <option value="">All interest types</option>
            {["Fixed", "Variable", "Hybrid"].map((t) => <option key={t}>{t}</option>)}
          </select>
          {filterIT && <button style={S.btnGhost} onClick={() => setFilterIT("")}>Clear</button>}
        </div>
        <Table
          cols={[
            { key: "id", label: "ID", nowrap: true },
            { key: "type", label: "Type" },
            { key: "bank", label: "Bank" },
            { key: "outstanding", label: "Outstanding", render: (v) => fmtM(v) },
            { key: "status", label: "Status", render: (v) => <Badge type={statusBadge(v || "Active")}>{v || "Active"}</Badge> },
            { key: "interestType", label: "Fixed/Var", render: (v) => <Badge type={v === "Fixed" ? "blue" : v === "Variable" ? "amber" : "gray"}>{v}</Badge> },
            { key: "rate", label: "Rate", render: (v, r) => `${fmtPct(v)}${r.interestType === "Variable" ? ` (AWPLR+${r.spread}%)` : ""}` },
            { key: "maturityDate", label: "Maturity" },
            {
              key: "actions", label: "",
              render: (_, r) => (
                <button onClick={(e) => { e.stopPropagation(); setModal(r); }} style={{ padding: "3px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-info)", background: "var(--color-background-info)", color: "var(--color-text-info)", cursor: "pointer", fontSize: 12 }}>
                  View
                </button>
              ),
            },
          ]}
          rows={filtered}
        />
      </GlassCard>

      {modal === "form" && (
        <Modal title="Add loan / facility" onClose={() => setModal(null)} wide>
          <div style={{background:"var(--color-background-info)",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"var(--color-text-info)"}}>
            This request will go to your Accountant first, then Company Head, then Treasury for final approval.
          </div>
          <FormRow>
            <div style={{ flex: 1 }}><Field label="Company" value={user.company} onChange={()=>{}} /></div>
            <div style={{ flex: 1 }}><Field label="Loan type" type="select" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={LOAN_TYPES} /></div>
          </FormRow>
          <FormRow>
            <div style={{ flex: 1 }}><Field label="Bank / institution" type="select" value={form.bank} onChange={(v) => setForm({ ...form, bank: v })} options={BANKS} /></div>
            <div style={{ flex: 1 }}><Field label="Bank account number" value={form.bankAccountNo} onChange={(v) => setForm({ ...form, bankAccountNo: v })} /></div>
          </FormRow>
          <FormRow>
            <div style={{ flex: 1 }}><Field label="Currency" type="select" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} options={CURRENCIES} /></div>
            <div style={{ flex: 1 }}><Field label="Facility amount (LKR)" type="number" value={form.facilityAmt} onChange={(v) => updateFormField({ facilityAmt: v })} /></div>
          </FormRow>
          <Field label="Outstanding balance" type="number" value={form.outstanding} onChange={(v) => setForm({ ...form, outstanding: v })} />
          <FormRow>
            <div style={{ flex: 1 }}><Field label="Interest type" type="select" value={form.interestType} onChange={(v) => setForm({ ...form, interestType: v })} options={["Fixed", "Variable", "Hybrid"]} /></div>
            <div style={{ flex: 1 }}><Field label="Interest rate (%)" type="number" value={form.rate} onChange={(v) => setForm({ ...form, rate: v })} /></div>
            {form.interestType !== "Fixed" && <div style={{ flex: 1 }}><Field label="Spread over AWPLR (%)" type="number" value={form.spread} onChange={(v) => setForm({ ...form, spread: v })} /></div>}
          </FormRow>
          <FormRow>
            <div style={{ flex: 1 }}><Field label="Facility date" type="date" value={form.facilityDate} onChange={(v) => updateFormField({ facilityDate: v })} /></div>
            <div style={{ flex: 1 }}><Field label="Maturity date" type="date" value={form.maturityDate} onChange={(v) => updateFormField({ maturityDate: v })} /></div>
          </FormRow>
          <FormRow>
            <div style={{ flex: 1 }}><Field label="Repayment frequency" type="select" value={form.repayFreq} onChange={(v) => updateFormField({ repayFreq: v })} options={REPAY_FREQ} /></div>
            <div style={{ flex: 1 }}>
              <Field label="Repayment amount (auto-calculated — edit to override)" type="number" value={form.repayAmt} onChange={(v) => { setRepayTouched(true); setForm({ ...form, repayAmt: v }); }} />
            </div>
          </FormRow>
          <Field label="Security / collateral" value={form.security} onChange={(v) => setForm({ ...form, security: v })} />
          <Field label="Purpose" value={form.purpose} onChange={(v) => setForm({ ...form, purpose: v })} />
          <FileUpload files={form.attachments} setFiles={f=>setForm({...form,attachments:f})} label="Loan documents (agreement, sanction letter, PDF/photo, etc.)" />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button style={S.btnGhost} onClick={() => setModal(null)}>Cancel</button>
            <button style={S.btn("#185FA5")} onClick={save} disabled={saving}>{saving ? "Submitting…" : "Submit for review"}</button>
          </div>
        </Modal>
      )}

      {modal && modal.id && !rejectOpen && (
        <Modal title={`${modal.company} / ${modal.bank}`} onClose={() => setModal(null)} wide>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <Badge type={statusBadge(modal.status || "Active")}>{modal.status || "Active"}</Badge>
          </div>

          {modal.status === "Rejected" && modal.rejectReason && (
            <div style={{background:"var(--color-background-danger)",border:"0.5px solid #f0c0c0",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
              <div style={{fontSize:11,color:"var(--color-text-danger)",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600,marginBottom:4}}>Rejection reason</div>
              <div style={{fontSize:13,color:"var(--color-text-danger)"}}>{modal.rejectReason}</div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
            {[["Facility amount",fmtFull(modal.facilityAmt)],["Outstanding",fmtFull(modal.outstanding)],["Rate",fmtPct(modal.rate)],["Freq",modal.repayFreq]].map(([k,v])=>(
              <div key={k} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
            {[["Facility date",modal.facilityDate],["Maturity date",modal.maturityDate],["Bank account",modal.bankAccountNo||"—"]].map(([k,v])=>(
              <div key={k} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:8}}><strong>Security:</strong> {modal.security}</p>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:16}}><strong>Purpose:</strong> {modal.purpose}</p>

          {modal.attachments?.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:6}}>Documents</div>
              {modal.attachments.map((f,i)=><a key={i} href={f.url} target="_blank" rel="noreferrer" style={{display:"block",fontSize:12,color:"var(--color-text-info)"}}>{f.name}</a>)}
            </div>
          )}

          {modal.editHistory?.length > 0 && (
            <GlassCard title="Edited by Treasury" style={{marginBottom:16}}>
              {modal.editHistory.map((e,i) => (
                <div key={i} style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:6}}>
                  <strong>{e.by}</strong> ({e.role}) on {e.date}: {e.changes}
                </div>
              ))}
            </GlassCard>
          )}

          {(modal.status||"Active") === "Active" && (
            <GlassCard title="Amortisation schedule" style={{marginBottom:8}}>
              <Table
                cols={[
                  { key: "period", label: "Period" }, { key: "date", label: "Date" },
                  { key: "opening", label: "Opening bal", render: (v) => v.toLocaleString() },
                  { key: "principal", label: "Principal", render: (v) => v.toLocaleString() },
                  { key: "interest", label: "Interest", render: (v) => v.toLocaleString() },
                  { key: "total", label: "Total payment", render: (v) => v.toLocaleString() },
                  { key: "closing", label: "Closing bal", render: (v) => v.toLocaleString() },
                ]}
                rows={genAmort(modal, 12)}
              />
            </GlassCard>
          )}

          {modal.status === "Pending Accountant Review" && canAccountantReview && (
            <ActionBox label="Accountant review needed">
              <button style={S.btn("#0F6E56")} disabled={acting} onClick={()=>accountantDecide(modal,"approve")}>{acting?"…":"Approve"}</button>
              <button style={S.btn("#A32D2D")} disabled={acting} onClick={()=>{setRejectReason(""); setRejectOpen(true);}}>Reject</button>
            </ActionBox>
          )}

          {modal.status === "Pending Company Head" && canCompanyHeadDecide && (
            <ActionBox label="Company Head approval needed">
              <button style={S.btn("#0F6E56")} disabled={acting} onClick={()=>companyHeadDecide(modal,"approve")}>{acting?"…":"Approve"}</button>
              <button style={S.btn("#A32D2D")} disabled={acting} onClick={()=>{setRejectReason(""); setRejectOpen(true);}}>Reject</button>
            </ActionBox>
          )}
        </Modal>
      )}

      {modal === "sens" && (
        <Modal title="AWPLR sensitivity analysis" onClose={() => setModal(null)}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px" }}>
            Annual interest cost impact if AWPLR moves from the current base of 10.0% ({user.company}'s active facilities only)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sensData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip formatter={(v) => `LKR ${v}M`} />
              <Bar dataKey="annual" name="Annual interest (LKR Mn)" radius={[6, 6, 0, 0]}>
                {sensData.map((e, i) => <Cell key={i} fill={e.d === 0 ? "#185FA5" : e.d > 0 ? "#A32D2D" : "#0F6E56"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <Table
            cols={[
              { key: "label", label: "AWPLR scenario" },
              { key: "annual", label: "Annual interest (LKR Mn)", render: (v) => `LKR ${v}M` },
              { key: "d", label: "Change vs base", render: (d, r) => {
                const b = sensData[2].annual; const diff = r.annual - b;
                return <span style={{ color: diff > 0 ? "#A32D2D" : diff < 0 ? "#0F6E56" : "var(--color-text-secondary)", fontWeight: 500 }}>{diff > 0 ? "+" : ""}{diff}M</span>;
              }},
            ]}
            rows={sensData}
          />
        </Modal>
      )}

      {rejectOpen && modal && (
        <Modal title={`Reject facility — ${modal.bank}`} onClose={()=>setRejectOpen(false)}>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:16}}>
            This will reject the facility request and notify the requester, with the reason shown below.
          </p>
          <Field label="Reason for rejection" type="textarea" value={rejectReason} onChange={setRejectReason} />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
            <button style={S.btnGhost} onClick={()=>setRejectOpen(false)}>Cancel</button>
            <button
              style={S.btn("#A32D2D")}
              disabled={acting}
              onClick={async ()=>{
                if (!rejectReason.trim()) { alert("Please enter a reason for rejection."); return; }
                if (modal.status === "Pending Accountant Review") {
                  await accountantDecide(modal,"reject",rejectReason);
                } else {
                  await companyHeadDecide(modal,"reject",rejectReason);
                }
                setRejectOpen(false);
              }}
            >
              {acting?"Rejecting…":"Confirm rejection"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}