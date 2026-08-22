import { useState } from "react";
import { COMPANIES } from "../../constants";
import { IC_PURPOSES } from "../../permissions";
import { fmtFull, fmtPct, fmt, TODAY, isOverdue, daysOverdue, calcAccruedInterest } from "../../utils";
import { GlassCard, KpiGlass, Badge, Table, Modal, Field, FormRow, PageHeader, S } from "../../components/UI";
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

function ActionBox({label, children}) {
  return (
    <div style={{background:"var(--color-background-info)",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,padding:"12px 14px",marginTop:8}}>
      <div style={{fontSize:13,fontWeight:600,color:"var(--color-text-info)",marginBottom:8}}>{label}</div>
      <div style={{display:"flex",gap:8}}>{children}</div>
    </div>
  );
}

async function loadUsers() {
  if (USE_MOCK) return MOCK_USERS.map(({password, ...u}) => u);
  try { return await usersApi.list(); } catch { return []; }
}

export default function IntercompanyReview({icLoans, setIcLoans}) {
  const { user } = useAuth();
  const { canDoAction } = usePermissions();
  const { notify } = useNotifications();
  const { logAction } = useAudit();

  const [detail, setDetail] = useState(null);
  const [lenderModal, setLenderModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tForm, setTForm] = useState(null);
  const [newRate, setNewRate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [acting, setActing] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleForm, setSettleForm] = useState({settledDate:fmt(TODAY), arRef:"", dnRef:"", attachments:[]});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [bankConfirmOpen, setBankConfirmOpen] = useState(false);
  const [bankRef, setBankRef] = useState("");
  const [bankConfirmed, setBankConfirmed] = useState(null);

  const canTreasuryAct = canDoAction(user, "treasury_decision");
  const canRelease = canDoAction(user, "release_payment");
  const canInitiateSettleAsTreasury = canDoAction(user, "settle_ic_loan") && user.role === "Treasury";

  const active = icLoans.filter(l=>l.status==="Active");
  const settled = icLoans.filter(l=>l.status==="Settled");
  const pending = icLoans.filter(l=>!["Active","Settled","Rejected"].includes(l.status));

  const STATUSES = [...new Set(icLoans.map(l=>l.status))];
  const filteredLoans = statusFilter ? icLoans.filter(l=>l.status===statusFilter) : icLoans;

  const updateReqLocal = (id, patch) => setIcLoans(prev => prev.map(l => l.id===id ? {...l, ...patch} : l));

  const openLenderForm = () => {
    setIsEditing(false);
    setTForm({ selectedCompanies:{}, amounts:{}, interestRate:"", finalRepaymentDate:detail.requestedRepaymentDate, finalPurpose:"", remarks:"", handlingFee:"" });
    setLenderModal(true);
  };

  const openEditLenderForm = () => {
    const decision = detail.treasuryDecision;
    const selectedCompanies = {};
    const amounts = {};
    decision.lenders.forEach(l => { selectedCompanies[l.company] = true; amounts[l.company] = String(l.amount); });
    setIsEditing(true);
    setTForm({
      selectedCompanies, amounts,
      interestRate: String(decision.interestRate),
      finalRepaymentDate: decision.finalRepaymentDate,
      finalPurpose: decision.finalPurpose,
      remarks: decision.remarks || "",
      handlingFee: String(decision.handlingFee || ""),
    });
    setLenderModal(true);
  };

  const toggleCompany = (company) => {
    setTForm(prev => {
      const nowSelected = !prev.selectedCompanies[company];
      const selectedCompanies = {...prev.selectedCompanies, [company]: nowSelected};
      const amounts = {...prev.amounts};
      if (!nowSelected) delete amounts[company];
      return {...prev, selectedCompanies, amounts};
    });
  };
  const setCompanyAmount = (company, val) => setTForm(prev => ({...prev, amounts: {...prev.amounts, [company]: val}}));
  const selectedList = tForm ? Object.keys(tForm.selectedCompanies).filter(c => tForm.selectedCompanies[c]) : [];
  const lenderSum = tForm ? selectedList.reduce((s,c) => s + (+tForm.amounts[c] || 0), 0) : 0;

  const treasuryApprove = async () => {
    if (selectedList.length === 0) { alert("Select at least one lender company."); return; }
    if (!tForm.interestRate || !tForm.finalPurpose || !tForm.finalRepaymentDate) { alert("Fill interest rate, final purpose, and repayment date."); return; }
    if (lenderSum !== detail.amount) { alert(`Lender amounts must total exactly ${fmtFull(detail.amount)} (currently ${fmtFull(lenderSum)}).`); return; }

    const lenders = selectedList.map(c => ({company:c, amount:+tForm.amounts[c]}));
    setActing(true);
    try {
      let updated;
      if (USE_MOCK) {
        const steps = detail.steps.map(s => s.order===3 ? {...s, status:"Approved", by:user.name, date:fmt(TODAY)} : s);
        const treasuryDecision = {
          lenders, interestRate:+tForm.interestRate,
          interestHistory: isEditing
            ? [...detail.treasuryDecision.interestHistory, { rate:+tForm.interestRate, fromDate:fmt(TODAY), setBy:user.name, note:"Revised by Treasury" }]
            : [{ rate:+tForm.interestRate, fromDate:fmt(TODAY), setBy:user.name }],
          finalRepaymentDate: tForm.finalRepaymentDate, finalPurpose: tForm.finalPurpose,
          remarks: tForm.remarks, handlingFee:+tForm.handlingFee||0, decidedBy:user.name, decidedDate:fmt(TODAY),
        };
        const lenderConfirmations = [];
        lenders.forEach(l => {
          lenderConfirmations.push({company:l.company, amount:l.amount, role:"Accountant", status:"Pending"});
          lenderConfirmations.push({company:l.company, amount:l.amount, role:"CompanyHead", status:"Pending"});
        });
        updated = {...detail, steps, treasuryDecision, lenderConfirmations, status:"Pending Lender Confirmation"};
      } else {
        updated = await intercompanyApi.treasuryDecide(detail.id, {
          action:"approve", lenders, interestRate:tForm.interestRate,
          finalRepaymentDate:tForm.finalRepaymentDate, finalPurpose:tForm.finalPurpose,
          remarks:tForm.remarks, handlingFee:tForm.handlingFee,
        });
      }
      updateReqLocal(detail.id, updated);
      setDetail(updated);
      notify({
        title: isEditing ? "Lender terms revised" : "Terms set — awaiting lender confirmation",
        message:`${detail.requestNo} ${isEditing ? "terms updated — " : "sent to "}${lenders.map(l=>l.company).join(", ")} for confirmation`,
        targetRoles:["CompanyHead","Accountant"], entityId:detail.id,
      });
      logAction({
        user, action: isEditing ? "Treasury edited lender assignment" : "Treasury approved & assigned lenders",
        entityType:"IC Loan", entityId:detail.requestNo,
        details:`Rate ${tForm.interestRate}%, lenders: ${lenders.map(l=>`${l.company} ${fmtFull(l.amount)}`).join(", ")}`,
      });

      if (!isEditing) {
        const users = await loadUsers();
        for (const l of lenders) {
          const acc = findUser(users, "Accountant", l.company);
          await sendActionEmail({
            toEmail: acc?.email, toName: acc?.name || "Accountant",
            message: `${detail.requestNo} — ${detail.borrowerCompany} needs ${fmtFull(l.amount)} in funding from ${l.company}. Please review and confirm.`,
            loanRef: detail.requestNo, borrower: detail.borrowerCompany, amount: fmtFull(l.amount),
          });
        }
      }

      setLenderModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  const confirmTreasuryReject = async () => {
    if (!rejectReason.trim()) { alert("Please enter a reason for rejection."); return; }
    setActing(true);
    try {
      let updated;
      if (USE_MOCK) {
        const steps = detail.steps.map(s => s.order===3 ? {...s, status:"Rejected", by:user.name, date:fmt(TODAY)} : s);
        updated = {...detail, steps, status:"Rejected", rejectReason};
      } else {
        updated = await intercompanyApi.treasuryDecide(detail.id, { action:"reject", reason:rejectReason });
      }
      updateReqLocal(detail.id, updated);
      setDetail(updated);
      notify({title:"Request rejected by Treasury", message:`${detail.requestNo}: ${rejectReason}`, targetEmails:[detail.requestedByEmail], targetRoles:["CompanyHead","Accountant"], entityId:detail.id});
      logAction({user, action:"Treasury rejected request", entityType:"IC Loan", entityId:detail.requestNo, details:rejectReason});

      await sendActionEmail({
        toEmail: detail.requestedByEmail, toName: detail.requestedBy,
        message: `Your intercompany funding request ${detail.requestNo} was rejected by Treasury. Reason: ${rejectReason}`,
        loanRef: detail.requestNo, borrower: detail.borrowerCompany, amount: fmtFull(detail.amount),
      });

      setRejectOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  // ── Release payment — now requires bank confirmation before approving ──
  const releasePayment = async (req, action="approve", reason="") => {
    if (action === "approve" && bankConfirmed !== true) {
      alert("Please confirm the bank payment has actually been processed before releasing.");
      return;
    }
    setActing(true);
    try {
      let updated;
      if (USE_MOCK) {
        if (action === "reject") {
          updated = {...req, financeController:{status:"Rejected", rejectedBy:user.name, rejectedDate:fmt(TODAY), reason}, status:"Rejected"};
        } else {
          updated = {...req, financeController:{status:"Released", releasedBy:user.name, releasedDate:fmt(TODAY), bankRef, bankConfirmed:true}, status:"Active"};
        }
      } else {
        updated = await intercompanyApi.releasePayment(req.id, action, reason, bankConfirmed, bankRef);
      }
      updateReqLocal(req.id, updated);
      setDetail(updated);
      if (action === "approve") {
        notify({title:"Payment released", message:`${req.requestNo} is now Active`, targetEmails:[req.requestedByEmail], targetRoles:["Treasury"], entityId:req.id});
        logAction({user, action:"Finance Controller released payment (bank confirmed)", entityType:"IC Loan", entityId:req.requestNo, details:`Bank ref: ${bankRef||"—"}`});

        const users = await loadUsers();
        const treasury = findUser(users, "Treasury");
        await sendActionEmail({
          toEmail: treasury?.email, toName: treasury?.name || "Treasury",
          message: `${req.requestNo} payment has been released by Finance Controller (bank confirmed, ref: ${bankRef||"—"}) — the loan is now Active.`,
          loanRef: req.requestNo, borrower: req.borrowerCompany, amount: fmtFull(req.amount),
        });
        await sendActionEmail({
          toEmail: req.requestedByEmail, toName: req.requestedBy,
          message: `Funds for ${req.requestNo} have been released. The loan is now Active.`,
          loanRef: req.requestNo, borrower: req.borrowerCompany, amount: fmtFull(req.amount),
        });
      } else {
        notify({title:"Payment release rejected", message:`${req.requestNo}: ${reason}`, targetEmails:[req.requestedByEmail], targetRoles:["Treasury"], entityId:req.id});
        logAction({user, action:"Finance Controller rejected payment release", entityType:"IC Loan", entityId:req.requestNo, details:reason});

        const users = await loadUsers();
        const treasury = findUser(users, "Treasury");
        await sendActionEmail({
          toEmail: treasury?.email, toName: treasury?.name || "Treasury",
          message: `${req.requestNo} payment release was rejected by Finance Controller. Reason: ${reason}`,
          loanRef: req.requestNo, borrower: req.borrowerCompany, amount: fmtFull(req.amount),
        });
      }
      setBankConfirmOpen(false); setBankRef(""); setBankConfirmed(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  const addNewRate = async () => {
    if (!newRate) return;
    setActing(true);
    try {
      let updated;
      if (USE_MOCK) {
        const history = [...detail.treasuryDecision.interestHistory, {rate:+newRate, fromDate:fmt(TODAY), setBy:user.name}];
        updated = {...detail, treasuryDecision:{...detail.treasuryDecision, interestRate:+newRate, interestHistory:history}};
      } else {
        updated = await intercompanyApi.addNewRate(detail.id, newRate);
      }
      updateReqLocal(detail.id, updated);
      setDetail(updated);
      setNewRate("");
      notify({title:"Interest rate updated (overdue loan)", message:`${detail.requestNo} rate changed to ${newRate}%`, targetEmails:[detail.requestedByEmail], entityId:detail.id});
      logAction({user, action:"Treasury updated overdue interest rate", entityType:"IC Loan", entityId:detail.requestNo, details:`New rate ${newRate}%`});

      await sendActionEmail({
        toEmail: detail.requestedByEmail, toName: detail.requestedBy,
        message: `${detail.requestNo} is overdue — the interest rate has been updated to ${newRate}%.`,
        loanRef: detail.requestNo, borrower: detail.borrowerCompany, amount: fmtFull(detail.amount),
      });
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
        { role:"Accountant", status:"Pending" },
        { role:"CompanyHead", status:"Pending" },
        { role:"FinanceController", status:"Pending" },
      ];
      if (USE_MOCK) {
        updated = {...detail, status:"Pending Settlement", settlement:{settled:false, ...settleForm, steps:settlementSteps, initiatedBy:user.name}};
      } else {
        updated = await intercompanyApi.initiateSettle(detail.id, settleForm);
      }
      updateReqLocal(detail.id, updated);
      setDetail(updated);
      notify({title:"Settlement initiated", message:`${detail.requestNo} settlement started — needs ${detail.borrowerCompany} Accountant confirmation`, targetRoles:["Accountant"], entityId:detail.id});
      logAction({user, action:"Treasury initiated settlement", entityType:"IC Loan", entityId:detail.requestNo});

      const users = await loadUsers();
      const accountant = findUser(users, "Accountant", detail.borrowerCompany);
      await sendActionEmail({
        toEmail: accountant?.email, toName: accountant?.name || "Accountant",
        message: `Settlement has been initiated for ${detail.requestNo}. Please confirm the settlement.`,
        loanRef: detail.requestNo, borrower: detail.borrowerCompany, amount: fmtFull(detail.amount),
      });

      setSettleOpen(false);
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
      setDetail(updated);

      if (updated.status === "Settled") {
        notify({title:"Loan settled", message:`${req.requestNo} fully repaid and closed`, targetEmails:[req.requestedByEmail], entityId:req.id});
        logAction({user, action:`Settlement ${role} ${action}d`, entityType:"IC Loan", entityId:req.requestNo});

        await sendActionEmail({
          toEmail: req.requestedByEmail, toName: req.requestedBy,
          message: `${req.requestNo} has been fully settled and closed.`,
          loanRef: req.requestNo, borrower: req.borrowerCompany, amount: fmtFull(req.amount),
        });
      } else if (updated.status === "Active" && action==="reject") {
        notify({title:"Settlement rejected", message:`${req.requestNo} settlement rejected by ${role} — loan remains Active`, targetRoles:["Treasury"], entityId:req.id});
        logAction({user, action:`Settlement ${role} ${action}d`, entityType:"IC Loan", entityId:req.requestNo});

        const users = await loadUsers();
        const treasury = findUser(users, "Treasury");
        await sendActionEmail({
          toEmail: treasury?.email, toName: treasury?.name || "Treasury",
          message: `${req.requestNo} settlement was rejected by ${role} — loan remains Active.`,
          loanRef: req.requestNo, borrower: req.borrowerCompany, amount: fmtFull(req.amount),
        });
      } else {
        logAction({user, action:`Settlement ${role} ${action}d`, entityType:"IC Loan", entityId:req.requestNo});
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  const statusBadge = (s) => s==="Active"?"green":s==="Settled"?"gray":s==="Rejected"?"red":"amber";
  const selectStyle = {padding:"6px 10px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",fontSize:13,background:"var(--color-background-primary)",color:"var(--color-text-primary)"};

  return (
    <div>
      <PageHeader title="Intercompany Funding — All Companies" />

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        <KpiGlass label="Active IC loans" value={active.length} sub={fmtFull(active.reduce((s,l)=>s+l.amount,0))} accent="#534AB7" icon="ti-arrows-exchange" />
        <KpiGlass label="Awaiting action" value={pending.length} accent="#BA7517" icon="ti-clock" />
        <KpiGlass label="Settled" value={settled.length} accent="#0F6E56" icon="ti-check" />
      </div>

      <GlassCard style={{marginBottom:16, display:"flex", gap:10, alignItems:"center"}}>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All statuses</option>
          {STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        {statusFilter && <button style={S.btnGhost} onClick={()=>setStatusFilter("")}>Clear</button>}
      </GlassCard>

      <GlassCard>
        <Table
          cols={[
            {key:"requestNo",label:"Ref"},
            {key:"borrowerCompany",label:"Borrower"},
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
          rows={filteredLoans}
        />
      </GlassCard>

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
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
            {[["Bank account",detail.bankAccountNo],["Requested date",detail.requestedDate],["Loan needed by",detail.loanNeededDate],["Requested repay by",detail.requestedRepaymentDate]].map(([k,v])=>(
              <div key={k} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{k}</div>
                <div style={{fontSize:14,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          {detail.reviewedBy && (
            <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:16}}>
              <strong>Reviewed by:</strong> {detail.reviewedBy}
            </div>
          )}
          <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:16}}><strong>Purpose:</strong> {detail.borrowerPurpose}</p>

          {detail.treasuryDecision && (
            <GlassCard
              title="Treasury terms"
              style={{marginBottom:16}}
              right={canTreasuryAct && detail.status==="Pending Lender Confirmation" ? (
                <button style={S.btnGhost} onClick={openEditLenderForm}>Edit</button>
              ) : null}
            >
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
                <div><div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Interest rate</div><div style={{fontWeight:600}}>{fmtPct(detail.treasuryDecision.interestRate)}</div></div>
                <div><div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Final repayment date</div><div style={{fontWeight:600}}>{detail.treasuryDecision.finalRepaymentDate}</div></div>
                <div><div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Purpose</div><div style={{fontWeight:600}}>{detail.treasuryDecision.finalPurpose}</div></div>
              </div>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:8}}>Lenders: {detail.treasuryDecision.lenders.map(l=>`${l.company} (${fmtFull(l.amount)})`).join(", ")}</div>
              {detail.treasuryDecision.remarks && <div style={{fontSize:12,marginBottom:8}}><strong>Remarks:</strong> {detail.treasuryDecision.remarks}</div>}
              <div style={{fontSize:12,color:"var(--color-text-warning)"}}><strong>Handling fee:</strong> {fmtFull(detail.treasuryDecision.handlingFee||0)} (borrower-paid)</div>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:8}}>Accrued interest to date: {fmtFull(calcAccruedInterest(detail))}</div>
            </GlassCard>
          )}

          {detail.financeController?.status === "Released" && (
            <GlassCard title="Bank payment confirmation" style={{marginBottom:16}}>
              <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                Released by {detail.financeController.releasedBy} on {detail.financeController.releasedDate}
                {detail.financeController.bankRef && <> · Bank ref: {detail.financeController.bankRef}</>}
              </div>
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

          {detail.status==="Pending Treasury" && canTreasuryAct && (
            <ActionBox label="Treasury decision needed">
              <button style={S.btn("#185FA5")} disabled={acting} onClick={openLenderForm}>+ Add Lender</button>
              <button style={S.btn("#A32D2D")} disabled={acting} onClick={()=>{setRejectReason(""); setRejectOpen(true);}}>Reject</button>
            </ActionBox>
          )}

          {detail.status==="Pending Lender Confirmation" && canTreasuryAct && (
            <p style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:4}}>
              Waiting on lender confirmation. Use <strong>Edit</strong> above to revise terms if needed.
            </p>
          )}

          {detail.status==="Pending Finance Controller" && canRelease && (
            <ActionBox label="All lenders confirmed — confirm bank payment before releasing">
              <button style={S.btn("#0F6E56")} disabled={acting} onClick={()=>{setBankConfirmed(null); setBankRef(""); setBankConfirmOpen(true);}}>Release payment</button>
              <button style={S.btn("#A32D2D")} disabled={acting} onClick={()=>{const r=prompt("Reason for rejecting the release:"); if(r!==null) releasePayment(detail,"reject",r);}}>Reject</button>
            </ActionBox>
          )}

          {detail.status==="Active" && !detail.settlement?.settled && isOverdue(detail.treasuryDecision?.finalRepaymentDate, false) && (
            <GlassCard title="Repayment overdue — update interest rate" style={{marginTop:12}}>
              <FormRow>
                <div style={{flex:1}}><Field label="New annual rate (%)" type="number" value={newRate} onChange={setNewRate} /></div>
                <div style={{flex:1,display:"flex",alignItems:"flex-end"}}><button style={S.btn("#BA7517")} disabled={acting} onClick={addNewRate}>Apply new rate</button></div>
              </FormRow>
            </GlassCard>
          )}

          {detail.status==="Active" && !detail.settlement?.settled && canInitiateSettleAsTreasury && (
            <>
              <SettlementBreakdown loan={detail} />
              <div style={{marginTop:4}}>
                <button style={S.btn("#0F6E56")} onClick={()=>{setSettleForm({settledDate:fmt(TODAY),arRef:"",dnRef:"",attachments:[]}); setSettleOpen(true);}}>Initiate settlement</button>
              </div>
            </>
          )}

          {detail.status==="Pending Settlement" && user.role==="FinanceController" && (() => {
            const accountantStep = detail.settlement.steps.find(x=>x.role==="Accountant");
            const headStep = detail.settlement.steps.find(x=>x.role==="CompanyHead");
            const myStep = detail.settlement.steps.find(s => s.role==="FinanceController" && s.status==="Pending");
            if (!myStep || accountantStep.status!=="Approved" || headStep.status!=="Approved") return null;
            return (
              <>
                <SettlementBreakdown loan={detail} />
                <ActionBox label="Settlement confirmation needed — Finance Controller">
                  <button style={S.btn("#0F6E56")} disabled={acting} onClick={()=>settlementAct(detail, "FinanceController", "approve")}>{acting?"…":"Confirm settlement"}</button>
                  <button style={S.btn("#A32D2D")} disabled={acting} onClick={()=>settlementAct(detail, "FinanceController", "reject")}>Reject</button>
                </ActionBox>
              </>
            );
          })()}
        </Modal>
      )}

      {bankConfirmOpen && detail && (
        <Modal title={`Confirm bank payment — ${detail.requestNo}`} onClose={()=>setBankConfirmOpen(false)}>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:16}}>
            Before marking this loan Active, confirm the bank transfer has actually been processed. Do not release without checking the bank statement or confirmation.
          </p>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <label style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:`1px solid ${bankConfirmed===true?"#0F6E56":"var(--color-border-secondary)"}`,borderRadius:8,cursor:"pointer"}}>
              <input type="radio" checked={bankConfirmed===true} onChange={()=>setBankConfirmed(true)} /> Bank payment confirmed
            </label>
            <label style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:`1px solid ${bankConfirmed===false?"#A32D2D":"var(--color-border-secondary)"}`,borderRadius:8,cursor:"pointer"}}>
              <input type="radio" checked={bankConfirmed===false} onChange={()=>setBankConfirmed(false)} /> Not yet confirmed
            </label>
          </div>
          <Field label="Bank reference / transaction ID" value={bankRef} onChange={setBankRef} />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
            <button style={S.btnGhost} onClick={()=>setBankConfirmOpen(false)}>Cancel</button>
            <button style={S.btn("#0F6E56")} disabled={acting || bankConfirmed!==true} onClick={()=>releasePayment(detail,"approve")}>
              {acting ? "Releasing…" : "Confirm & Release"}
            </button>
          </div>
        </Modal>
      )}

      {settleOpen && detail && (
        <Modal title={`Initiate settlement — ${detail.requestNo}`} onClose={()=>setSettleOpen(false)}>
          <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:14}}>
            This starts the settlement approval chain: {detail.borrowerCompany}'s Accountant → Company Head → Finance Controller. The loan is only marked Settled once all three confirm.
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

      {rejectOpen && detail && (
        <Modal title={`Reject ${detail.requestNo}`} onClose={()=>setRejectOpen(false)}>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:16}}>
            This will reject the request and notify {detail.borrowerCompany}'s Accountant and Company Head, with the reason shown below.
          </p>
          <Field label="Reason for rejection" type="textarea" value={rejectReason} onChange={setRejectReason} />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
            <button style={S.btnGhost} onClick={()=>setRejectOpen(false)}>Cancel</button>
            <button style={S.btn("#A32D2D")} onClick={confirmTreasuryReject} disabled={acting}>{acting?"Rejecting…":"Confirm rejection"}</button>
          </div>
        </Modal>
      )}

      {lenderModal && detail && tForm && (
        <Modal title={isEditing ? `Edit Lender & Terms — ${detail.requestNo}` : `Add Lender — ${detail.requestNo}`} onClose={()=>setLenderModal(false)} wide>
          <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:12}}>
            Treasury cannot change the borrower's requested amount, dates, or purpose — only assign lender(s) and set terms below.
            {isEditing && " Changing these terms will reset lender confirmations — every lender will need to re-confirm."}
          </p>
          <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13}}>
            <strong>{detail.borrowerCompany}</strong> requested <strong>{fmtFull(detail.amount)}</strong> — {detail.borrowerPurpose}
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600}}>Select lender company / companies</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginBottom:14}}>
              {COMPANIES.filter(c=>c!==detail.borrowerCompany).map(c => {
                const checked = !!tForm.selectedCompanies[c];
                return (
                  <label key={c} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", border:`1px solid ${checked?"#185FA5":"var(--color-border-secondary)"}`, borderRadius:8, cursor:"pointer", fontSize:13, background: checked ? "var(--color-background-info)" : "var(--color-background-primary)", color: checked ? "var(--color-text-info)" : "var(--color-text-primary)" }}>
                    <input type="checkbox" checked={checked} onChange={()=>toggleCompany(c)} style={{width:15,height:15}} />
                    {c}
                  </label>
                );
              })}
            </div>
            {selectedList.length > 0 && (
              <>
                <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600}}>Amount per company (must total {fmtFull(detail.amount)})</div>
                {selectedList.map(c => (
                  <FormRow key={c}>
                    <div style={{flex:1,display:"flex",alignItems:"center",fontSize:13,fontWeight:600,color:"var(--color-text-primary)"}}>{c}</div>
                    <div style={{flex:2}}><Field label={`Amount for ${c}`} type="number" value={tForm.amounts[c]||""} onChange={v=>setCompanyAmount(c,v)} /></div>
                  </FormRow>
                ))}
                <div style={{fontSize:12,marginTop:4,color: lenderSum===detail.amount ? "var(--color-text-success)" : "var(--color-text-danger)"}}>
                  Total allocated: {fmtFull(lenderSum)} / {fmtFull(detail.amount)}
                </div>
              </>
            )}
          </div>
          <FormRow>
            <div style={{flex:1}}><Field label="Interest rate (%)" type="number" value={tForm.interestRate} onChange={v=>setTForm({...tForm,interestRate:v})} /></div>
            <div style={{flex:1}}><Field label="Final repayment date" type="date" value={tForm.finalRepaymentDate} onChange={v=>setTForm({...tForm,finalRepaymentDate:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Purpose" type="select" value={tForm.finalPurpose} onChange={v=>setTForm({...tForm,finalPurpose:v})} options={IC_PURPOSES} /></div>
            <div style={{flex:1}}><Field label="Handling fee (LKR — borrower pays)" type="number" value={tForm.handlingFee} onChange={v=>setTForm({...tForm,handlingFee:v})} /></div>
          </FormRow>
          <Field label="Remarks" type="textarea" value={tForm.remarks} onChange={v=>setTForm({...tForm,remarks:v})} />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>setLenderModal(false)}>Cancel</button>
            <button style={S.btn("#0F6E56")} disabled={acting} onClick={treasuryApprove}>
              {acting ? "Saving…" : isEditing ? "Save changes & re-notify lender(s)" : "Approve & submit to lender(s)"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}