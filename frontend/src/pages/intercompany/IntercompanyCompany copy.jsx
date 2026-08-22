import { useState, useMemo } from "react";
import { BANKS, IC_LOAN_TYPES } from "../../constants";
import { fmtFull, fmtPct, fmt, TODAY, isOverdue, daysOverdue, calcAccruedInterest, outstandingSummary } from "../../utils";
import { GlassCard, KpiGlass, Badge, Table, Modal, Field, FormRow, PageHeader, TabBar, S } from "../../components/UI";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionsContext";
import { useNotifications } from "../../context/NotificationsContext";
import { useAudit } from "../../context/AuditContext";
import { intercompanyApi } from "../../api/treasury";
import { USE_MOCK } from "../../config";
import FileUpload from "../../components/FileUpload";

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

export default function IntercompanyCompany({icLoans, setIcLoans}) {
  const { user } = useAuth();
  const { canDoAction } = usePermissions();
  const { notify } = useNotifications();
  const { logAction } = useAudit();

  const [tab, setTab] = useState("borrowing");
  const [detail, setDetail] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleForm, setSettleForm] = useState({settledDate:fmt(TODAY), arRef:"", dnRef:""});
  const [saving, setSaving] = useState(false);

  const canRequest = canDoAction(user, "new_funding_request") && user.role === "Accountant";
  const canCompanyHeadDecide = user.role === "CompanyHead";
  const canLenderAct = canDoAction(user, "lender_confirm");
  const canSettle = canDoAction(user, "settle_ic_loan");

  const myBorrowRequests = useMemo(() => icLoans.filter(r => r.borrowerCompany === user.company), [icLoans, user.company]);
  const myLendRequests = useMemo(() => icLoans.filter(r => r.treasuryDecision?.lenders?.some(l=>l.company===user.company)), [icLoans, user.company]);

  const myOutstanding = outstandingSummary(icLoans, user.company);
  const activeBorrow = myBorrowRequests.filter(l=>l.status==="Active");
  const settledBorrow = myBorrowRequests.filter(l=>l.status==="Settled");
  const pendingBorrow = myBorrowRequests.filter(l=>!["Active","Settled","Rejected"].includes(l.status));

  // "requestedDate" is intentionally absent here — it is never user-entered.
  // It's set automatically to today's date at the moment of submission (see submitRequest below).
  const blankReq = {
    borrowerCompany:user.company, amount:"", borrowerPurpose:"",
    bankName:"", bankAccountNo:"", loanType:"",
    loanNeededDate:"", requestedRepaymentDate:"",
    remarks:"", attachments:[],
  };
  const [form, setForm] = useState(blankReq);

  const updateReq = (id, patch) => setIcLoans(prev => prev.map(l => l.id===id ? {...l, ...patch} : l));

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
        requestedDate: fmt(TODAY), // ← always the submission date, never user-editable
        loanNeededDate: form.loanNeededDate,
        requestedRepaymentDate: form.requestedRepaymentDate, remarks: form.remarks,
        attachments: form.attachments, requestedBy: user.name, requestedByEmail: user.email,
        status:"Pending Company Head",
        steps:[
          {order:1, role:"Accountant", company:user.company, status:"Approved", by:user.name, date:fmt(TODAY)},
          {order:2, role:"CompanyHead", company:user.company, status:"Pending"},
          {order:3, role:"Treasury", status:"Pending"},
        ],
        treasuryDecision:null, lenderConfirmations:[], financeController:{status:"Pending"}, settlement:{settled:false},
      };

      if (USE_MOCK) {
        setIcLoans([req, ...icLoans]);
      } else {
        // Backend also sets the date server-side (see createIcLoan controller) —
        // this client value is a convenience for the mock path only.
        const created = await intercompanyApi.createLoan(req);
        setIcLoans([created, ...icLoans]);
      }

      notify({title:"New IC loan request", message:`${req.requestNo} — ${fmtFull(req.amount)} needs your Company Head's approval`, targetRoles:["CompanyHead"], entityId:id});
      logAction({user, action:"Created IC loan request", entityType:"IC Loan", entityId:req.requestNo, details:`${fmtFull(req.amount)} — ${form.borrowerPurpose}`});
      setNewModal(false); setForm(blankReq);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const actOnBorrowerStep = (req, action, reason="") => {
    const steps = req.steps.map(s => s.order===2 ? {...s, status:action==="approve"?"Approved":"Rejected", by:user.name, date:fmt(TODAY)} : s);
    const newStatus = action==="approve" ? "Pending Treasury" : "Rejected";
    updateReq(req.id, {steps, status:newStatus, rejectReason: action==="reject"?reason:undefined});
    notify({title:action==="approve"?"Request approved — sent to Treasury":"Request rejected",
      message:`${req.requestNo} ${action==="approve"?"moved to Treasury review":"was rejected by Company Head"}`,
      targetRoles: action==="approve" ? ["Treasury"] : [], targetEmails:[req.requestedByEmail], entityId:req.id});
    logAction({user, action:`Company Head ${action}d request`, entityType:"IC Loan", entityId:req.requestNo});
    setDetail(null);
  };

  const lenderAct = (req, action) => {
    const updatedConf = req.lenderConfirmations.map(c =>
      (c.company===user.company && c.role===user.role) ? {...c, status:action==="approve"?"Approved":"Rejected", by:user.name, date:fmt(TODAY)} : c
    );
    const anyRejected = updatedConf.some(c=>c.status==="Rejected");
    const allApproved = updatedConf.every(c=>c.status==="Approved");
    const newStatus = anyRejected ? "Rejected" : allApproved ? "Pending Finance Controller" : "Pending Lender Confirmation";
    updateReq(req.id, {lenderConfirmations:updatedConf, status:newStatus});
    if (anyRejected) {
      notify({title:"Lender rejected funding", message:`${user.company} (${user.role}) rejected ${req.requestNo}`, targetEmails:[req.requestedByEmail], targetRoles:["Treasury"], entityId:req.id});
    } else if (allApproved) {
      notify({title:"All lenders confirmed — ready for release", message:`${req.requestNo} awaiting Finance Controller`, targetRoles:["FinanceController"], entityId:req.id});
    }
    logAction({user, action:`Lender ${user.company} (${user.role}) ${action}d`, entityType:"IC Loan", entityId:req.requestNo});
    setDetail(null);
  };

  const confirmSettle = () => {
    updateReq(detail.id, {settlement:{settled:true, ...settleForm}, status:"Settled"});
    notify({title:"Intercompany loan settled", message:`${detail.requestNo} fully repaid and closed`, targetEmails:[detail.requestedByEmail], entityId:detail.id});
    logAction({user, action:"Loan settled", entityType:"IC Loan", entityId:detail.requestNo});
    setDetail(null); setSettleOpen(false);
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

          <div style={{display:"flex",gap:2,overflowX:"auto",marginBottom:16}}>
            {[...detail.steps,
              ...(detail.lenderConfirmations||[]).map((l,i)=>({order:100+i, role:`${l.company} — ${l.role}`, status:l.status})),
              {order:200, role:"Finance Controller", status:detail.financeController?.status==="Released"?"Approved":(detail.status==="Pending Finance Controller"?"Pending":"—")},
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

          {detail.attachments?.length>0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:6}}>Attachments</div>
              {detail.attachments.map((f,i)=><a key={i} href={f.url} target="_blank" rel="noreferrer" style={{display:"block",fontSize:12,color:"var(--color-text-info)"}}>{f.name}</a>)}
            </div>
          )}

          {detail.status==="Pending Company Head" && canCompanyHeadDecide && user.company===detail.borrowerCompany && (
            <ActionBox label="Company Head approval needed">
              <button style={S.btn("#0F6E56")} onClick={()=>actOnBorrowerStep(detail,"approve")}>Approve</button>
              <button style={S.btn("#A32D2D")} onClick={()=>{const r=prompt("Reason for rejection:"); if(r!==null) actOnBorrowerStep(detail,"reject",r);}}>Reject</button>
            </ActionBox>
          )}

          {detail.status==="Pending Lender Confirmation" && canLenderAct && detail.lenderConfirmations
            .filter(c => c.company===user.company && c.role===user.role && c.status==="Pending")
            .map(c => (
              <ActionBox key={`${c.company}-${c.role}`} label={`Confirmation needed — funding ${fmtFull(c.amount)} to ${detail.borrowerCompany} at ${fmtPct(detail.treasuryDecision.interestRate)}`}>
                <button style={S.btn("#0F6E56")} onClick={()=>lenderAct(detail,"approve")}>Approve</button>
                <button style={S.btn("#A32D2D")} onClick={()=>lenderAct(detail,"reject")}>Reject</button>
              </ActionBox>
          ))}

          {detail.status==="Active" && !detail.settlement?.settled && canSettle && detail.borrowerCompany===user.company && (
            <div style={{marginTop:12}}>
              <button style={S.btn("#0F6E56")} onClick={()=>{setSettleForm({settledDate:fmt(TODAY),arRef:"",dnRef:""}); setSettleOpen(true);}}>Settle loan</button>
            </div>
          )}
        </Modal>
      )}

      {settleOpen && detail && (
        <Modal title={`Settle ${detail.requestNo}`} onClose={()=>setSettleOpen(false)}>
          <Field label="Settlement date" type="date" value={settleForm.settledDate} onChange={v=>setSettleForm({...settleForm,settledDate:v})} />
          <FormRow>
            <div style={{flex:1}}><Field label="AR Reference" value={settleForm.arRef} onChange={v=>setSettleForm({...settleForm,arRef:v})} /></div>
            <div style={{flex:1}}><Field label="DN Reference" value={settleForm.dnRef} onChange={v=>setSettleForm({...settleForm,dnRef:v})} /></div>
          </FormRow>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>setSettleOpen(false)}>Cancel</button>
            <button style={S.btn("#0F6E56")} onClick={confirmSettle}>Confirm settlement</button>
          </div>
        </Modal>
      )}
    </div>
  );
}