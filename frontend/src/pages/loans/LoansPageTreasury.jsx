import { useState } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { COMPANIES, BANKS, CURRENCIES, REPAY_FREQ } from "../../constants";
import { fmtM, fmtFull, fmtPct, wtdRate, genAmort, loanEditHistoryEntry, suggestRepayAmount } from "../../utils";
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

const FIELD_LABELS = {
  bank:"Bank", bankAccountNo:"Bank account", currency:"Currency", facilityAmt:"Facility amount",
  outstanding:"Outstanding", interestType:"Interest type", rate:"Rate", spread:"Spread",
  facilityDate:"Facility date", maturityDate:"Maturity date", repayFreq:"Repayment frequency",
  repayAmt:"Repayment amount", security:"Security", purpose:"Purpose",
};

function ActionBox({label, children}) {
  return (
    <div style={{background:"var(--color-background-info)",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,padding:"12px 14px",marginTop:8}}>
      <div style={{fontSize:13,fontWeight:600,color:"var(--color-text-info)",marginBottom:8}}>{label}</div>
      <div style={{display:"flex",gap:8}}>{children}</div>
    </div>
  );
}

export default function LoansPageTreasury({loans, setLoans}) {
  const { user } = useAuth();
  const { canDoAction } = usePermissions();
  const { notify } = useNotifications();
  const { logAction } = useAudit();
  const canApprove = canDoAction(user, "approve_facility");

  const [modal, setModal] = useState(null);
  const [filterCo, setFilterCo] = useState("");
  const [filterIT, setFilterIT] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editRepayTouched, setEditRepayTouched] = useState(false);
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = loans.filter(l => (!filterCo||l.company===filterCo) && (!filterIT||l.interestType===filterIT));
  const activeFiltered = filtered.filter(l => (l.status || "Active") === "Active");
  const totalDebt = activeFiltered.reduce((s,l)=>s+l.outstanding,0);
  const fixedDebt = activeFiltered.filter(l=>l.interestType==="Fixed").reduce((s,l)=>s+l.outstanding,0);
  const varDebt = activeFiltered.filter(l=>l.interestType!=="Fixed").reduce((s,l)=>s+l.outstanding,0);
  const pendingCount = filtered.filter(l=>l.status==="Pending Treasury Approval").length;

  const sensData = [-2,-1,0,1,2].map(d => {
    const base = 10.0 + d;
    const ann = activeFiltered.reduce((s,l) => {
      const r = l.interestType==="Fixed" ? l.rate : (l.spread + base);
      return s + l.outstanding * r / 100;
    },0);
    return {label:d===0?"Base (10%)":`${d>0?"+":""}${d}%`,annual:Math.round(ann/1e6),d};
  });

  const openEdit = (loan) => {
    setEditForm({...loan, facilityAmt:String(loan.facilityAmt), outstanding:String(loan.outstanding), rate:String(loan.rate), spread:String(loan.spread||0), repayAmt:String(loan.repayAmt||0), attachments: loan.attachments||[]});
    setEditRepayTouched(true);
    setEditModal(loan);
  };

  const updateEditField = (patch) => {
    const next = {...editForm, ...patch};
    const drivingFieldsChanged = "facilityAmt" in patch || "facilityDate" in patch || "maturityDate" in patch || "repayFreq" in patch;
    if (drivingFieldsChanged && !editRepayTouched) {
      next.repayAmt = String(suggestRepayAmount(next.facilityAmt, next.facilityDate, next.maturityDate, next.repayFreq) || "");
    }
    setEditForm(next);
  };

  const diffSummary = (original, edited) => {
    const changes = [];
    Object.keys(FIELD_LABELS).forEach(key => {
      const before = String(original[key] ?? "");
      const after = String(edited[key] ?? "");
      if (before !== after) changes.push(`${FIELD_LABELS[key]}: "${before}" → "${after}"`);
    });
    return changes.join("; ");
  };

  const saveEdit = async () => {
    const changesText = diffSummary(editModal, editForm);
    const payload = {
      bank: editForm.bank, bankAccountNo: editForm.bankAccountNo, currency: editForm.currency,
      facilityAmt: +editForm.facilityAmt, outstanding: +editForm.outstanding,
      interestType: editForm.interestType, rate: +editForm.rate, spread: +editForm.spread || 0,
      facilityDate: editForm.facilityDate, maturityDate: editForm.maturityDate,
      repayFreq: editForm.repayFreq, repayAmt: +editForm.repayAmt || 0,
      security: editForm.security, purpose: editForm.purpose,
      attachments: editForm.attachments, changesSummary: changesText || "Edited by Treasury (no field changes)",
    };
    try {
      let updated;
      if (USE_MOCK) {
        updated = {...editModal, ...payload, editHistory: [...(editModal.editHistory||[]), loanEditHistoryEntry(user, payload.changesSummary)]};
      } else {
        updated = await loansApi.update(editModal.id, payload);
      }
      setLoans(loans.map(l => l.id===editModal.id ? updated : l));
      logAction({user, action:"Treasury edited loan facility", entityType:"Loan", entityId:editModal.id, details:changesText});

      if (updated.requestedByEmail) {
        await sendActionEmail({
          toEmail: updated.requestedByEmail, toName: updated.requestedBy,
          message: `Treasury has edited your facility request at ${updated.bank}. Changes: ${changesText || "resubmitted with no changes"}`,
          loanRef: updated.id, borrower: updated.company, amount: fmtFull(updated.outstanding),
        });
      }
      const users = await loadUsers();
      const head = findUser(users, "CompanyHead", updated.company);
      await sendActionEmail({
        toEmail: head?.email, toName: head?.name || "Company Head",
        message: `Treasury has edited the facility request at ${updated.bank} for your company.`,
        loanRef: updated.id, borrower: updated.company, amount: fmtFull(updated.outstanding),
      });

      setEditModal(null); setEditForm(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const decide = async (loan, action, reason="") => {
    setActing(true);
    try {
      let updated;
      if (USE_MOCK) {
        updated = {...loan, status: action === "approve" ? "Active" : "Rejected", rejectReason: action==="reject"?reason:undefined};
      } else {
        updated = await loansApi.decide(loan.id, action, reason);
      }
      setLoans(loans.map(l => l.id===loan.id ? updated : l));
      notify({
        title:`Facility ${action==="approve"?"approved":"rejected"}`,
        message:`${loan.company} facility at ${loan.bank} (${fmtFull(loan.outstanding)}) ${action==="approve"?"is now active":"was rejected by Treasury"}`,
        targetRoles:["CompanyHead","Accountant"], entityId:loan.id,
      });
      logAction({user, action:`Treasury ${action}d loan facility`, entityType:"Loan", entityId:loan.id, details:`${loan.company} — ${fmtFull(loan.outstanding)} at ${loan.bank}`});
      if (loan.requestedByEmail) {
        await sendActionEmail({
          toEmail: loan.requestedByEmail, toName: loan.requestedBy,
          message: `Your facility at ${loan.bank} was ${action==="approve"?"approved and is now Active":`rejected. Reason: ${reason}`} by Treasury.`,
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
  const statusBadge = (s) => s==="Active"?"green":s==="Rejected"?"red":s==="Pending Treasury Approval"?"amber":"gray";

  return (
    <div>
      <PageHeader title="Loans & Borrowings — All Companies">
        <button style={S.btnGhost} onClick={() => setModal("sens")}>AWPLR sensitivity</button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <KpiGlass label="Total outstanding (Active)" value={fmtM(totalDebt)} accent="#A32D2D" icon="ti-credit-card" />
        <KpiGlass label="Fixed rate debt" value={fmtM(fixedDebt)} sub={totalDebt ? `${((fixedDebt/totalDebt)*100).toFixed(0)}% of total` : ""} accent="#534AB7" icon="ti-lock" />
        <KpiGlass label="Variable rate debt" value={fmtM(varDebt)} sub={totalDebt ? `${((varDebt/totalDebt)*100).toFixed(0)}% of total` : ""} accent="#BA7517" icon="ti-trending-up" />
        <KpiGlass label="Pending Treasury approval" value={pendingCount} accent="#0F6E56" icon="ti-clock" />
      </div>

      <GlassCard style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <select value={filterCo} onChange={(e) => setFilterCo(e.target.value)} style={selectStyle}>
            <option value="">All companies</option>
            {COMPANIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={filterIT} onChange={(e) => setFilterIT(e.target.value)} style={selectStyle}>
            <option value="">All interest types</option>
            {["Fixed", "Variable", "Hybrid"].map((t) => <option key={t}>{t}</option>)}
          </select>
          {(filterCo || filterIT) && <button style={S.btnGhost} onClick={() => { setFilterCo(""); setFilterIT(""); }}>Clear</button>}
        </div>
        <Table
          cols={[
            { key: "id", label: "ID", nowrap: true },
            { key: "company", label: "Company" },
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
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={(e) => { e.stopPropagation(); setModal(r); }} style={{ padding: "3px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-info)", background: "var(--color-background-info)", color: "var(--color-text-info)", cursor: "pointer", fontSize: 12 }}>
                    View
                  </button>
                  {r.status === "Pending Treasury Approval" && canApprove && (
                    <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} style={{ padding:"3px 10px", borderRadius:6, border:"0.5px solid var(--color-border-secondary)", background:"var(--color-background-primary)", color:"var(--color-text-primary)", cursor:"pointer", fontSize:12 }}>
                      Edit
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      </GlassCard>

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

          {modal.status === "Pending Treasury Approval" && canApprove && (
            <ActionBox label="Treasury decision needed">
              <button style={S.btn("#0F6E56")} disabled={acting} onClick={()=>decide(modal,"approve")}>{acting?"…":"Approve"}</button>
              <button style={S.btnGhost} onClick={()=>{setModal(null); openEdit(modal);}}>Edit first</button>
              <button style={S.btn("#A32D2D")} disabled={acting} onClick={()=>{setRejectReason(""); setRejectOpen(true);}}>Reject</button>
            </ActionBox>
          )}
        </Modal>
      )}

      {modal === "sens" && (
        <Modal title="AWPLR sensitivity analysis" onClose={() => setModal(null)}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px" }}>
            Annual interest cost impact if AWPLR moves from the current base of 10.0% (Active facilities only)
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
            This will reject the facility and notify the requesting Accountant and Company Head, with the reason shown below.
          </p>
          <Field label="Reason for rejection" type="textarea" value={rejectReason} onChange={setRejectReason} />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
            <button style={S.btnGhost} onClick={()=>setRejectOpen(false)}>Cancel</button>
            <button
              style={S.btn("#A32D2D")}
              disabled={acting}
              onClick={async ()=>{
                if (!rejectReason.trim()) { alert("Please enter a reason for rejection."); return; }
                await decide(modal,"reject",rejectReason);
                setRejectOpen(false);
              }}
            >
              {acting?"Rejecting…":"Confirm rejection"}
            </button>
          </div>
        </Modal>
      )}

      {editModal && editForm && (
        <Modal title={`Edit facility — ${editModal.company} / ${editModal.bank}`} onClose={()=>{setEditModal(null);setEditForm(null);}} wide>
          <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:14}}>
            Treasury can adjust any field before final approval. Changes are logged and shown to the Accountant and Company Head.
          </p>
          <FormRow>
            <div style={{flex:1}}><Field label="Bank" type="select" value={editForm.bank} onChange={v=>setEditForm({...editForm,bank:v})} options={BANKS} /></div>
            <div style={{flex:1}}><Field label="Bank account number" value={editForm.bankAccountNo||""} onChange={v=>setEditForm({...editForm,bankAccountNo:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Currency" type="select" value={editForm.currency} onChange={v=>setEditForm({...editForm,currency:v})} options={CURRENCIES} /></div>
            <div style={{flex:1}}><Field label="Facility amount (LKR)" type="number" value={editForm.facilityAmt} onChange={v=>updateEditField({facilityAmt:v})} /></div>
          </FormRow>
          <Field label="Outstanding balance" type="number" value={editForm.outstanding} onChange={v=>setEditForm({...editForm,outstanding:v})} />
          <FormRow>
            <div style={{flex:1}}><Field label="Interest type" type="select" value={editForm.interestType} onChange={v=>setEditForm({...editForm,interestType:v})} options={["Fixed","Variable","Hybrid"]} /></div>
            <div style={{flex:1}}><Field label="Interest rate (%)" type="number" value={editForm.rate} onChange={v=>setEditForm({...editForm,rate:v})} /></div>
            {editForm.interestType !== "Fixed" && <div style={{flex:1}}><Field label="Spread over AWPLR (%)" type="number" value={editForm.spread} onChange={v=>setEditForm({...editForm,spread:v})} /></div>}
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Facility date" type="date" value={editForm.facilityDate} onChange={v=>updateEditField({facilityDate:v})} /></div>
            <div style={{flex:1}}><Field label="Maturity date" type="date" value={editForm.maturityDate} onChange={v=>updateEditField({maturityDate:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Repayment frequency" type="select" value={editForm.repayFreq} onChange={v=>updateEditField({repayFreq:v})} options={REPAY_FREQ} /></div>
            <div style={{flex:1}}>
              <Field label="Repayment amount (auto-calculated — edit to override)" type="number" value={editForm.repayAmt} onChange={v=>{setEditRepayTouched(true); setEditForm({...editForm,repayAmt:v});}} />
            </div>
          </FormRow>
          <Field label="Security / collateral" value={editForm.security} onChange={v=>setEditForm({...editForm,security:v})} />
          <Field label="Purpose" value={editForm.purpose} onChange={v=>setEditForm({...editForm,purpose:v})} />
          <FileUpload files={editForm.attachments} setFiles={f=>setEditForm({...editForm,attachments:f})} label="Additional documents" />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>{setEditModal(null);setEditForm(null);}}>Cancel</button>
            <button style={S.btn("#185FA5")} onClick={saveEdit}>Save changes</button>
          </div>
        </Modal>
      )}
    </div>
  );
}