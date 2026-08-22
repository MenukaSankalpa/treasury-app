import { useState, useMemo } from "react";
import { BANKS, IC_LOAN_TYPES } from "../../constants";
import { fmtFull, fmtPct, fmt, TODAY, isOverdue, daysOverdue, calcAccruedInterest, outstandingSummary } from "../../utils";
import { GlassCard, KpiGlass, Badge, Table, Modal, Field, FormRow, PageHeader, TabBar, S } from "../../components/UI";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionsContext";
import { useNotifications } from "../../context/NotificationsContext";
import { useAudit } from "../../context/AuditContext";
import { intercompanyApi } from "../../api/treasury";
import { usersApi } from "../../api/users";
import { USE_MOCK } from "../../config";
import { MOCK_USERS } from "../../mockUsers";
import FileUpload from "../../components/FileUpload";
import SettlementBreakdown from "../../components/SettlementBreakdown";
import { sendActionEmail, findUser } from "../../lib/emailService";

function canSeeHandlingFee(user, req) {
  return user.company === req.borrowerCompany;
}

function OutstandingPanel({summary, company}) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
      <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"10px 14px"}}>
        <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{company} — current outstanding</div>
        <div style={{fontSize:16,fontWeight:700}}>{fmtFull(summary.currentTotal)}</div>
        <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{summary.currentCount} loan(s)</div>
      </div>
      <div style={{background:"var(--color-background-danger)",borderRadius:10,padding:"10px 14px"}}>
        <div style={{fontSize:11,color:"var(--color-text-danger)"}}>{company} — overdue</div>
        <div style={{fontSize:16,fontWeight:700,color:"var(--color-text-danger)"}}>{fmtFull(summary.overdueTotal)}</div>
        <div style={{fontSize:11,color:"var(--color-text-danger)"}}>{summary.overdueCount} loan(s) past due</div>
      </div>
    </div>
  );
}

function ActionBox({label, children}) {
  return (
    <div style={{background:"var(--color-background-info)",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,padding:"12px 14px",marginTop:8}}>
      <div style={{fontSize:13,fontWeight:600,color:"var(--color-text-info)",marginBottom:8}}>{label}</div>
      <div style={{display:"flex",gap:8}}>{children}</div>
    </div>
  );
}

const genReqNo = (seq) => `ICR-${TODAY.getFullYear()}-${String(seq).padStart(4,"0")}`;

async function loadUsers() {
  if (USE_MOCK) return MOCK_USERS.map(({password, ...u}) => u);
  try { return await usersApi.list(); } catch { return []; }
}

export default function IntercompanyCompany({icLoans, setIcLoans}) {
  const { user } = useAuth();
  const { canDoAction } = usePermissions();
  const { notify } = useNotifications();
  const { logAction } = useAudit();

  const [tab, setTab] = useState("borrowing");
  const [detail, setDetail] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleForm, setSettleForm] = useState({settledDate:fmt(TODAY), arRef:"", dnRef:"", attachments:[]});
  const [chRejectOpen, setChRejectOpen] = useState(false);
  const [chRejectReason, setChRejectReason] = useState("");

  const canRequest = canDoAction(user, "new_funding_request") && user.role === "Accountant";
  const canCompanyHeadDecide = user.role === "CompanyHead";
  const canLenderAct = canDoAction(user, "lender_confirm");
  const canInitiateSettleAsBorrower = (user.role === "Accountant" || user.role === "CompanyHead") && canDoAction(user, "settle_ic_loan");

  const myBorrowRequests = useMemo(() => icLoans.filter(r => r.borrowerCompany === user.company), [icLoans, user.company]);
  const myLendRequests = useMemo(() => icLoans.filter(r => r.treasuryDecision?.lenders?.some(l=>l.company===user.company)), [icLoans, user.company]);

  const myOutstanding = outstandingSummary(icLoans, user.company);
  const activeBorrow = myBorrowRequests.filter(l=>l.status==="Active");
  const settledBorrow = myBorrowRequests.filter(l=>l.status==="Settled");
  const pendingBorrow = myBorrowRequests.filter(l=>!["Active","Settled","Rejected"].includes(l.status));

  const blankReq = {
    borrowerCompany:user.company, amount:"", borrowerPurpose:"",
    bankName:"", bankAccountNo:"", loanType:"",
    loanNeededDate:"", requestedRepaymentDate:"",
    remarks:"", attachments:[],
  };
  const [form, setForm] = useState(blankReq);

  const updateReqLocal = (id, patch) => setIcLoans(prev => prev.map(l => l.id===id ? {...l, ...patch} : l));

  const submitRequest = async () => {
    if (!form.bankName || !form.bankAccountNo || !form.loanType || !form.loanNeededDate || !form.requestedRepaymentDate) {
      alert("Please fill in Bank, Account No., Loan Type, Loan Needed Date, and Repayment Date.");
      return;
    }
    setSaving(true);
    try {
      const id = "ICR"+Date.now();
      const req = {
        id, requestNo: genReqNo(icLoans.length+1),
        borrowerCompany: user.company, amount:+form.amount,
        borrowerPurpose: form.borrowerPurpose,
        bankName: form.bankName, bankAccountNo: form.bankAccountNo, loanType: form.loanType,
        requestedDate: fmt(TODAY),
        loanNeededDate: form.loanNeededDate,
        requestedRepaymentDate: form.requestedRepaymentDate, remarks: form.remarks,
        attachments: form.attachments, requestedBy: user.name, requestedByEmail: user.email,
        status:"Pending Company Head",
        steps:[
          {order:1, role:"Accountant", company:user.company, status:"Approved", by:user.name, date:fmt(TODAY)},
          {order:2, role:"CompanyHead", company:user.company, status:"Pending"},
          {order:3, role:"Treasury", status:"Pending"},
        ],
        treasuryDecision:null, lenderConfirmations:[], financeController:{status:"Pending"}, settlement:{settled:false, steps:[]},
      };

      if (USE_MOCK) {
        setIcLoans([req, ...icLoans]);
      } else {
        const created = await intercompanyApi.createLoan(req);
        setIcLoans([created, ...icLoans]);
      }

      notify({title:"New IC loan request", message:`${req.requestNo} — ${fmtFull(req.amount)} needs your Company Head's approval`, targetRoles:["CompanyHead"], entityId:id});
      logAction({user, action:"Created IC loan request", entityType:"IC Loan", entityId:req.requestNo, details:`${fmtFull(req.amount)} — ${form.borrowerPurpose}`});

      const users = await loadUsers();
      const head = findUser(users, "CompanyHead", user.company);
      await sendActionEmail({
        toEmail: head?.email, toName: head?.name || "Company Head",
        message: `${req.requestNo} — ${fmtFull(req.amount)} needs your approval before it goes to Treasury.`,
        loanRef: req.requestNo, borrower: user.company, amount: fmtFull(req.amount),
      });

      setNewModal(false); setForm(blankReq);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const actOnBorrowerStep = async (req, action, reason="") => {
    setActing(true);
    try {
      let updated;
      if (USE_MOCK) {
        const steps = req.steps.map(s => s.order===2 ? {...s, status:action==="approve"?"Approved":"Rejected", by:user.name, date:fmt(TODAY)} : s);
        const newStatus = action==="approve" ? "Pending Treasury" : "Rejected";
        updated = {...req, steps, status:newStatus, rejectReason: action==="reject"?reason:undefined};
      } else {
        updated = await intercompanyApi.companyHeadDecide(req.id, action, reason);
      }
      updateReqLocal(req.id, updated);
      notify({title:action==="approve"?"Request approved — sent to Treasury":"Request rejected",
        message:`${req.requestNo} ${action==="approve"?"moved to Treasury review":"was rejected by Company Head"}`,
        targetRoles: action==="approve" ? ["Treasury"] : [], targetEmails:[req.requestedByEmail], entityId:req.id});
      logAction({user, action:`Company Head ${action}d request`, entityType:"IC Loan", entityId:req.requestNo});

      if (action === "approve") {
        const users = await loadUsers();
        const treasury = findUser(users, "Treasury");
        await sendActionEmail({
          toEmail: treasury?.email, toName: treasury?.name || "Treasury",
          message: `${req.requestNo} has been approved by Company Head and needs Treasury to assign a lender and set terms.`,
          loanRef: req.requestNo, borrower: req.borrowerCompany, amount: fmtFull(req.amount),
        });
      } else {
        await sendActionEmail({
          toEmail: req.requestedByEmail, toName: req.requestedBy,
          message: `Your intercompany funding request ${req.requestNo} was rejected by Company Head. Reason: ${reason}`,
          loanRef: req.requestNo, borrower: req.borrowerCompany, amount: fmtFull(req.amount),
        });
      }

      setDetail(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  const lenderAct = async (req, action) => {
    setActing(true);
    try {
      let updated;
      if (USE_MOCK) {
        const updatedConf = req.lenderConfirmations.map(c =>
          (c.company===user.company && c.role===user.role) ? {...c, status:action==="approve"?"Approved":"Rejected", by:user.name, date:fmt(TODAY)} : c
        );
        const anyRejected = updatedConf.some(c=>c.status==="Rejected");
        const allApproved = updatedConf.length > 0 && updatedConf.every(c=>c.status==="Approved");
        const newStatus = anyRejected ? "Rejected" : allApproved ? "Pending Finance Controller" : "Pending Lender Confirmation";
        updated = {...req, lenderConfirmations:updatedConf, status:newStatus};
      } else {
        updated = await intercompanyApi.lenderDecide(req.id, user.company, user.role, action);
      }
      updateReqLocal(req.id, updated);
      if (updated.status === "Rejected") {
        notify({title:"Lender rejected funding", message:`${user.company} (${user.role}) rejected ${req.requestNo}`, targetEmails:[req.requestedByEmail], targetRoles:["Treasury"], entityId:req.id});
      } else if (updated.status === "Pending Finance Controller") {
        notify({title:"All lenders confirmed — ready for release", message:`${req.requestNo} awaiting Finance Controller`, targetRoles:["FinanceController"], entityId:req.id});

        const users = await loadUsers();
        const fc = findUser(users, "FinanceController");
        await sendActionEmail({
          toEmail: fc?.email, toName: fc?.name || "Finance Controller",
          message: `All lenders have confirmed funding for ${req.requestNo}. Please review and release the payment.`,
          loanRef: req.requestNo, borrower: req.borrowerCompany, amount: fmtFull(req.amount),
        });
      }
      logAction({user, action:`Lender ${user.company} (${user.role}) ${action}d`, entityType:"IC Loan", entityId:req.requestNo});
      setDetail(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  const settlementAct = async (req, role, action) => {
    setActing(true);
    try {
      let updated;
      if (USE_MOCK) {
        const steps = req.settlement.steps.map(s => s.role===role ? {...s, status:action==="approve"?"Approved":"Rejected", by:user.name, date:fmt(TODAY)} : s);
        const anyRejected = steps.some(s=>s.status==="Rejected");
        const allApproved = steps.every(s=>s.status==="Approved");
        const settlement = {...req.settlement, steps};
        const newStatus = anyRejected ? "Active" : allApproved ? "Settled" : "Pending Settlement";
        updated = {...req, settlement: {...settlement, settled: allApproved}, status: newStatus};
      } else {
        updated = await intercompanyApi.settlementDecide(req.id, role, action);
      }
      updateReqLocal(req.id, updated);
      if (updated.status === "Settled") {
        notify({title:"Loan settled", message:`${req.requestNo} fully repaid and closed`, targetEmails:[req.requestedByEmail], entityId:req.id});
      } else if (updated.status === "Active" && action==="reject") {
        notify({title:"Settlement rejected", message:`${req.requestNo} settlement rejected by ${role} — loan remains Active`, targetRoles:["Treasury"], entityId:req.id});
      } else if (role === "CompanyHead" && action === "approve") {
        const users = await loadUsers();
        const fc = findUser(users, "FinanceController");
        await sendActionEmail({
          toEmail: fc?.email, toName: fc?.name || "Finance Controller",
          message: `${req.requestNo} settlement is ready for your final confirmation.`,
          loanRef: req.requestNo, borrower: req.borrowerCompany, amount: fmtFull(req.amount),
        });
      }
      logAction({user, action:`Settlement ${role} ${action}d`, entityType:"IC Loan", entityId:req.requestNo});
      setDetail(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  const initiateSettle = async () => {
    setActing(true);
    try {
      let updated;
      const settlementSteps = [
        { role:"Accountant", status: user.role==="Accountant" ? "Approved" : "Pending", by: user.role==="Accountant" ? user.name : undefined, date: user.role==="Accountant" ? fmt(TODAY) : undefined },
        { role:"CompanyHead", status: user.role==="CompanyHead" ? "Approved" : "Pending", by: user.role==="CompanyHead" ? user.name : undefined, date: user.role==="CompanyHead" ? fmt(TODAY) : undefined },
        { role:"FinanceController", status:"Pending" },
      ];
      if (USE_MOCK) {
        updated = {...detail, status:"Pending Settlement", settlement:{settled:false, ...settleForm, steps:settlementSteps, initiatedBy:user.name}};
      } else {
        updated = await intercompanyApi.initiateSettle(detail.id, settleForm);
      }
      updateReqLocal(detail.id, updated);
      setDetail(updated);
      notify({title:"Settlement initiated", message:`${detail.requestNo} settlement started by ${user.company}`, targetRoles:["Treasury"], entityId:detail.id});

      const users = await loadUsers();
      if (user.role !== "Accountant") {
        const accountant = findUser(users, "Accountant", detail.borrowerCompany);
        await sendActionEmail({
          toEmail: accountant?.email, toName: accountant?.name || "Accountant",
          message: `${detail.requestNo} settlement has been initiated. Please confirm.`,
          loanRef: detail.requestNo, borrower: detail.borrowerCompany, amount: fmtFull(detail.amount),
        });
      } else {
        const head = findUser(users, "CompanyHead", detail.borrowerCompany);
        await sendActionEmail({
          toEmail: head?.email, toName: head?.name || "Company Head",
          message: `${detail.requestNo} settlement has been initiated and confirmed by your Accountant. Please confirm.`,
          loanRef: detail.requestNo, borrower: detail.borrowerCompany, amount: fmtFull(detail.amount),
        });
      }

      logAction({user, action:`${user.role} initiated settlement`, entityType:"IC Loan", entityId:detail.requestNo});
      setSettleOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  const statusBadge = (s) => s==="Active"?"green":s==="Settled"?"gray":s==="Rejected"?"red":"amber";

  return (
    <div>
      <PageHeader title={`Intercompany Funding — ${user.company}`}>
        {canRequest && <button style={S.btn("#534AB7")} onClick={()=>{setForm(blankReq);setNewModal(true);}}>+ New funding request</button>}
      </PageHeader>

      {(myOutstanding.currentCount>0 || myOutstanding.overdueCount>0) && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:16}}>
          <KpiGlass label="Current Outstanding" value={fmtFull(myOutstanding.currentTotal)} sub={`${myOutstanding.currentCount} loan(s)`} accent="#185FA5" icon="ti-credit-card" />
          <KpiGlass label="Overdue" value={fmtFull(myOutstanding.overdueTotal)} sub={`${myOutstanding.overdueCount} loan(s) past due`} accent="#A32D2D" icon="ti-alert-triangle" />
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        <KpiGlass label="Active borrowed" value={activeBorrow.length} sub={fmtFull(activeBorrow.reduce((s,l)=>s+l.amount,0))} accent="#534AB7" icon="ti-arrows-exchange" />
        <KpiGlass label="Awaiting action" value={pendingBorrow.length} accent="#BA7517" icon="ti-clock" />
        <KpiGlass label="Settled" value={settledBorrow.length} accent="#0F6E56" icon="ti-check" />
      </div>

      <TabBar tabs={[{key:"borrowing",label:"Our Requests"},{key:"lending",label:"Funding We're Providing"}]} active={tab} onChange={setTab} />

      {tab === "borrowing" && (
        <GlassCard>
          <Table
            cols={[
              {key:"requestNo",label:"Ref"},
              {key:"loanType",label:"Loan Type"},
              {key:"bankName",label:"Bank"},
              {key:"amount",label:"Amount",render:v=>fmtFull(v)},
              {key:"status",label:"Status",render:(v,r)=>(
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  <Badge type={statusBadge(v)}>{v}</Badge>
                  {v==="Active" && isOverdue(r.treasuryDecision?.finalRepaymentDate, r.settlement?.settled) && <Badge type="red">Overdue</Badge>}
                </div>
              )},
              {key:"requestedRepaymentDate",label:"Repay By",render:(v,r)=>r.treasuryDecision?.finalRepaymentDate || v},
              {key:"id",label:"",render:(_,r)=><button onClick={e=>{e.stopPropagation();setDetail(r);}} style={{padding:"3px 10px",borderRadius:6,border:"0.5px solid var(--color-border-info)",background:"var(--color-background-info)",color:"var(--color-text-info)",cursor:"pointer",fontSize:12}}>View</button>},
            ]}
            rows={myBorrowRequests}
          />
        </GlassCard>
      )}

      {tab === "lending" && (
        <GlassCard>
          {myLendRequests.length === 0 && (
            <div style={{textAlign:"center", color:"var(--color-text-secondary)", padding:32}}>No funding assigned to {user.company} yet</div>
          )}
          <Table
            cols={[
              {key:"requestNo",label:"Ref"},
              {key:"borrowerCompany",label:"Borrower"},
              {key:"loanType",label:"Loan Type"},
              {key:"treasuryDecision",label:"Our Amount",render:(v,r)=>{
                const mine = r.treasuryDecision?.lenders?.find(l=>l.company===user.company);
                return mine ? fmtFull(mine.amount) : "—";
              }},
              {key:"status",label:"Status",render:v=><Badge type={statusBadge(v)}>{v}</Badge>},
              {key:"id",label:"",render:(_,r)=><button onClick={e=>{e.stopPropagation();setDetail(r);}} style={{padding:"3px 10px",borderRadius:6,border:"0.5px solid var(--color-border-info)",background:"var(--color-background-info)",color:"var(--color-text-info)",cursor:"pointer",fontSize:12}}>View</button>},
            ]}
            rows={myLendRequests}
          />
        </GlassCard>
      )}

      {newModal && (
        <Modal title="New intercompany funding request" onClose={()=>setNewModal(false)} wide>
          <OutstandingPanel summary={myOutstanding} company={user.company} />
          <div style={{background:"var(--color-background-info)",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"var(--color-text-info)"}}>
            This request will go to your Company Head first, then to Treasury for lender assignment and final terms.
          </div>

          <FormRow>
            <div style={{flex:1}}><Field label="Bank" type="select" value={form.bankName} onChange={v=>setForm({...form,bankName:v})} options={BANKS} /></div>
            <div style={{flex:1}}><Field label="Bank account number" value={form.bankAccountNo} onChange={v=>setForm({...form,bankAccountNo:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Loan type" type="select" value={form.loanType} onChange={v=>setForm({...form,loanType:v})} options={IC_LOAN_TYPES} /></div>
            <div style={{flex:1}}><Field label="Amount (LKR)" type="number" value={form.amount} onChange={v=>setForm({...form,amount:v})} /></div>
          </FormRow>
          <Field label="Purpose / business reason" type="textarea" value={form.borrowerPurpose} onChange={v=>setForm({...form,borrowerPurpose:v})} />

          <FormRow>
            <div style={{flex:1}}>
              <label style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4,display:"block",fontWeight:500}}>Requested date</label>
              <div style={{padding:"7px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,fontSize:13,background:"var(--color-background-secondary)",color:"var(--color-text-secondary)"}}>
                {fmt(TODAY)} (today — set automatically)
              </div>
            </div>
            <div style={{flex:1}}><Field label="Loan needed date" type="date" value={form.loanNeededDate} onChange={v=>setForm({...form,loanNeededDate:v})} /></div>
          </FormRow>
          <Field label="Repayment date" type="date" value={form.requestedRepaymentDate} onChange={v=>setForm({...form,requestedRepaymentDate:v})} />
          <Field label="Remarks (optional)" type="textarea" value={form.remarks} onChange={v=>setForm({...form,remarks:v})} />
          <FileUpload files={form.attachments} setFiles={f=>setForm({...form,attachments:f})} />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>setNewModal(false)}>Cancel</button>
            <button style={S.btn("#534AB7")} onClick={submitRequest} disabled={saving}>{saving?"Submitting…":"Submit request"}</button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={`${detail.requestNo} — ${detail.borrowerCompany}`} onClose={()=>setDetail(null)} wide>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <Badge type={statusBadge(detail.status)}>{detail.status}</Badge>
            {detail.status==="Active" && isOverdue(detail.treasuryDecision?.finalRepaymentDate, detail.settlement?.settled) && (
              <Badge type="red">Overdue by {daysOverdue(detail.treasuryDecision.finalRepaymentDate)} days</Badge>
            )}
          </div>

          {detail.status==="Rejected" && detail.rejectReason && (
            <div style={{background:"var(--color-background-danger)",border:"0.5px solid #f0c0c0",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
              <div style={{fontSize:11,color:"var(--color-text-danger)",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600,marginBottom:4}}>Rejection reason</div>
              <div style={{fontSize:13,color:"var(--color-text-danger)"}}>{detail.rejectReason}</div>
            </div>
          )}

          <div style={{display:"flex",gap:2,overflowX:"auto",marginBottom:16}}>
            {[...detail.steps,
              ...(detail.lenderConfirmations||[]).map((l,i)=>({order:100+i, role:`${l.company} — ${l.role}`, status:l.status})),
              {order:200, role:"Finance Controller (release)", status:detail.financeController?.status==="Released"?"Approved":detail.financeController?.status==="Rejected"?"Rejected":(detail.status==="Pending Finance Controller"?"Pending":"—")},
              ...(detail.settlement?.steps||[]).map((s,i)=>({order:300+i, role:`Settlement — ${s.role}`, status:s.status})),
            ].map((s,i)=>(
              <div key={i} style={{flex:"1 1 90px",textAlign:"center",padding:"0 4px"}}>
                <div style={{width:26,height:26,borderRadius:"50%",margin:"0 auto 6px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,
                  background:s.status==="Approved"?"#0F6E56":s.status==="Rejected"?"#A32D2D":"var(--color-background-secondary)",
                  color:s.status==="Approved"||s.status==="Rejected"?"#fff":"var(--color-text-secondary)"}}>
                  {s.status==="Approved"?"✓":s.status==="Rejected"?"✕":i+1}
                </div>
                <div style={{fontSize:10,color:"var(--color-text-secondary)",lineHeight:1.3}}>{s.role}</div>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
            {[["Amount",fmtFull(detail.amount)],["Loan type",detail.loanType],["Bank",detail.bankName]].map(([k,v])=>(
              <div key={k} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{k}</div>
                <div style={{fontSize:14,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
            {[["Bank account",detail.bankAccountNo],["Requested date",detail.requestedDate],["Loan needed by",detail.loanNeededDate],["Requested repay by",detail.requestedRepaymentDate]].map(([k,v])=>(
              <div key={k} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{k}</div>
                <div style={{fontSize:14,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:16}}><strong>Purpose:</strong> {detail.borrowerPurpose}</p>

          {detail.treasuryDecision && (
            <GlassCard title="Treasury terms" style={{marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
                <div><div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Interest rate</div><div style={{fontWeight:600}}>{fmtPct(detail.treasuryDecision.interestRate)}</div></div>
                <div><div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Final repayment date</div><div style={{fontWeight:600}}>{detail.treasuryDecision.finalRepaymentDate}</div></div>
                <div><div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Purpose</div><div style={{fontWeight:600}}>{detail.treasuryDecision.finalPurpose}</div></div>
              </div>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:8}}>Lenders: {detail.treasuryDecision.lenders.map(l=>`${l.company} (${fmtFull(l.amount)})`).join(", ")}</div>
              {detail.treasuryDecision.remarks && <div style={{fontSize:12,marginBottom:8}}><strong>Remarks:</strong> {detail.treasuryDecision.remarks}</div>}
              {canSeeHandlingFee(user, detail) && (
                <div style={{fontSize:12,color:"var(--color-text-warning)"}}><strong>Handling fee:</strong> {fmtFull(detail.treasuryDecision.handlingFee||0)}</div>
              )}
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:8}}>Accrued interest to date: {fmtFull(calcAccruedInterest(detail))}</div>
            </GlassCard>
          )}

          {detail.settlement?.steps?.length > 0 && (
            <GlassCard title="Settlement approval" style={{marginBottom:16}}>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:8}}>
                Settlement date: {detail.settlement.settledDate} · AR Ref: {detail.settlement.arRef || "—"} · DN Ref: {detail.settlement.dnRef || "—"}
              </div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:10}}>
                {detail.settlement.steps.map((s,i) => (
                  <Badge key={i} type={s.status==="Approved"?"green":s.status==="Rejected"?"red":"amber"}>{s.role}: {s.status}</Badge>
                ))}
              </div>
              {detail.settlement.attachments?.length > 0 && (
                <div>
                  <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:6}}>Settlement proof</div>
                  {detail.settlement.attachments.map((f,i)=><a key={i} href={f.url} target="_blank" rel="noreferrer" style={{display:"block",fontSize:12,color:"var(--color-text-info)"}}>{f.name}</a>)}
                </div>
              )}
            </GlassCard>
          )}

          {detail.attachments?.length>0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:6}}>Attachments</div>
              {detail.attachments.map((f,i)=><a key={i} href={f.url} target="_blank" rel="noreferrer" style={{display:"block",fontSize:12,color:"var(--color-text-info)"}}>{f.name}</a>)}
            </div>
          )}

          {detail.status==="Pending Company Head" && canCompanyHeadDecide && user.company===detail.borrowerCompany && (
            <ActionBox label="Company Head approval needed">
              <button style={S.btn("#0F6E56")} disabled={acting} onClick={()=>actOnBorrowerStep(detail,"approve")}>{acting?"…":"Approve"}</button>
              <button style={S.btn("#A32D2D")} disabled={acting} onClick={()=>{setChRejectReason(""); setChRejectOpen(true);}}>Reject</button>
            </ActionBox>
          )}

          {detail.status==="Pending Lender Confirmation" && canLenderAct && detail.lenderConfirmations
            .filter(c => c.company===user.company && c.role===user.role && c.status==="Pending")
            .map(c => (
              <ActionBox key={`${c.company}-${c.role}`} label={`Confirmation needed — funding ${fmtFull(c.amount)} to ${detail.borrowerCompany} at ${fmtPct(detail.treasuryDecision.interestRate)}`}>
                <button style={S.btn("#0F6E56")} disabled={acting} onClick={()=>lenderAct(detail,"approve")}>{acting?"…":"Approve"}</button>
                <button style={S.btn("#A32D2D")} disabled={acting} onClick={()=>lenderAct(detail,"reject")}>Reject</button>
              </ActionBox>
          ))}

          {detail.status==="Pending Settlement" && user.company===detail.borrowerCompany && (() => {
            const accountantStep = detail.settlement.steps.find(x=>x.role==="Accountant");
            const myStep = detail.settlement.steps.find(s =>
              s.role===user.role && s.status==="Pending" &&
              (s.role==="Accountant" || accountantStep.status==="Approved")
            );
            if (!myStep) return null;
            if (user.role !== "Accountant" && user.role !== "CompanyHead") return null;
            return (
              <>
                <SettlementBreakdown loan={detail} />
                <ActionBox label={`Settlement confirmation needed — ${user.role}`}>
                  <button style={S.btn("#0F6E56")} disabled={acting} onClick={()=>settlementAct(detail, user.role, "approve")}>{acting?"…":"Confirm settlement"}</button>
                  <button style={S.btn("#A32D2D")} disabled={acting} onClick={()=>settlementAct(detail, user.role, "reject")}>Reject</button>
                </ActionBox>
              </>
            );
          })()}

          {detail.status==="Active" && !detail.settlement?.settled && canInitiateSettleAsBorrower && detail.borrowerCompany===user.company && (
            <>
              <SettlementBreakdown loan={detail} />
              <div style={{marginTop:4}}>
                <button style={S.btn("#0F6E56")} onClick={()=>{setSettleForm({settledDate:fmt(TODAY),arRef:"",dnRef:"",attachments:[]}); setSettleOpen(true);}}>Settle loan</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {settleOpen && detail && (
        <Modal title={`Settle ${detail.requestNo}`} onClose={()=>setSettleOpen(false)}>
          <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:14}}>
            This starts the settlement approval chain: your Accountant → Company Head → Finance Controller. The loan is only marked Settled once all three confirm.
          </p>
          <SettlementBreakdown loan={detail} />
          <Field label="Settlement date" type="date" value={settleForm.settledDate} onChange={v=>setSettleForm({...settleForm,settledDate:v})} />
          <FormRow>
            <div style={{flex:1}}><Field label="AR Reference" value={settleForm.arRef} onChange={v=>setSettleForm({...settleForm,arRef:v})} /></div>
            <div style={{flex:1}}><Field label="DN Reference" value={settleForm.dnRef} onChange={v=>setSettleForm({...settleForm,dnRef:v})} /></div>
          </FormRow>
          <FileUpload files={settleForm.attachments} setFiles={f=>setSettleForm({...settleForm,attachments:f})} label="Settlement proof (payment slip, bank confirmation, etc.)" />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>setSettleOpen(false)}>Cancel</button>
            <button style={S.btn("#0F6E56")} onClick={initiateSettle} disabled={acting}>{acting?"Saving…":"Initiate settlement"}</button>
          </div>
        </Modal>
      )}

      {chRejectOpen && detail && (
        <Modal title={`Reject ${detail.requestNo}`} onClose={()=>setChRejectOpen(false)}>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:16}}>
            This will reject the request and notify the requesting Accountant, with the reason shown below.
          </p>
          <Field label="Reason for rejection" type="textarea" value={chRejectReason} onChange={setChRejectReason} />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
            <button style={S.btnGhost} onClick={()=>setChRejectOpen(false)}>Cancel</button>
            <button
              style={S.btn("#A32D2D")}
              disabled={acting}
              onClick={async ()=>{
                if (!chRejectReason.trim()) { alert("Please enter a reason for rejection."); return; }
                await actOnBorrowerStep(detail,"reject",chRejectReason);
                setChRejectOpen(false);
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