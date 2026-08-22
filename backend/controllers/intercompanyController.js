import { pool } from "../config/db.js";
import { createNotification } from "./notificationsController.js";
import { logAction } from "./auditController.js";

const genReqNo = async () => {
  const [rows] = await pool.query("SELECT COUNT(*) AS c FROM ic_loans");
  const seq = rows[0].c + 1;
  return `ICR-${new Date().getFullYear()}-${String(seq).padStart(4,"0")}`;
};

function safeJSON(val, fallback) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return val;
}

function toApi(r) {
  return {
    id:r.id, requestNo:r.request_no, borrowerCompany:r.borrower_company, amount:+r.amount,
    borrowerPurpose:r.borrower_purpose,
    bankName:r.bank_name, bankAccountNo:r.bank_account_no, loanType:r.loan_type,
    requestedDate:r.grant_date, loanNeededDate:r.loan_needed_date,
    requestedRepaymentDate:r.requested_repayment_date,
    remarks:r.remarks, attachments: safeJSON(r.attachments, []),
    requestedBy:r.requested_by, requestedByEmail:r.requested_by_email, status:r.status,
    reviewedBy: r.reviewed_by,
    steps: safeJSON(r.steps, []),
    treasuryDecision: safeJSON(r.treasury_decision, null),
    lenderConfirmations: safeJSON(r.lender_confirmations, []),
    financeController: safeJSON(r.finance_controller, {status:"Pending"}),
    settlement: safeJSON(r.settlement, {settled:false}),
    rejectReason: r.reject_reason,
  };
}

async function getOne(id) {
  const [rows] = await pool.query("SELECT * FROM ic_loans WHERE id=?", [id]);
  return rows[0] ? toApi(rows[0]) : null;
}

async function saveFields(id, fields) {
  const cols = []; const vals = [];
  const map = {
    status:"status", steps:"steps", treasuryDecision:"treasury_decision",
    lenderConfirmations:"lender_confirmations", financeController:"finance_controller",
    settlement:"settlement", rejectReason:"reject_reason",
  };
  for (const [key, col] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      cols.push(`${col}=?`);
      vals.push(typeof fields[key]==="object" ? JSON.stringify(fields[key]) : fields[key]);
    }
  }
  if (!cols.length) return;
  vals.push(id);
  await pool.query(`UPDATE ic_loans SET ${cols.join(",")} WHERE id=?`, vals);
}

export async function getIcLoans(req, res) {
  const { role, company } = req.user;
  const [rows] = await pool.query("SELECT * FROM ic_loans ORDER BY created_at DESC");
  let all = rows.map(toApi);
  if (!["SuperAdmin","GCFO","FinanceController","Treasury"].includes(role)) {
    all = all.filter(r => r.borrowerCompany===company || r.treasuryDecision?.lenders?.some(l=>l.company===company));
  }
  res.json(all);
}

export async function getIcLoan(req, res) {
  const loan = await getOne(req.params.id);
  if (!loan) return res.status(404).json({ error:"Not found" });
  res.json(loan);
}

// ── 1. Team Member submits request → goes to Accountant first ──
export async function createIcLoan(req, res) {
  try {
    const l = req.body;
    const id = "ICR"+Date.now();
    const requestNo = await genReqNo();
    const today = new Date().toISOString().split("T")[0];
    const steps = [
      { order:1, role:"TeamMember", company:l.borrowerCompany, status:"Approved", by:req.user.name, date: today },
      { order:2, role:"Accountant", company:l.borrowerCompany, status:"Pending" },
      { order:3, role:"CompanyHead", company:l.borrowerCompany, status:"Pending" },
      { order:4, role:"Treasury", status:"Pending" },
    ];
    await pool.query(
      `INSERT INTO ic_loans
        (id, request_no, borrower_company, amount, borrower_purpose,
         bank_name, bank_account_no, loan_type,
         grant_date, loan_needed_date, requested_repayment_date,
         remarks, attachments, requested_by, requested_by_email, status, reviewed_by,
         steps, lender_confirmations, finance_controller, settlement)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, requestNo, l.borrowerCompany, l.amount, l.borrowerPurpose,
       l.bankName, l.bankAccountNo, l.loanType,
       today, l.loanNeededDate, l.requestedRepaymentDate,
       l.remarks||"", JSON.stringify(l.attachments||[]), req.user.name, req.user.email, "Pending Accountant Review", l.reviewedBy||null,
       JSON.stringify(steps), JSON.stringify([]), JSON.stringify({status:"Pending"}), JSON.stringify({settled:false})]
    );
    await createNotification({ title:"New IC loan request", message:`${requestNo} — ${l.amount} from ${l.borrowerCompany} needs Accountant review`, targetRoles:["Accountant"], entityId:id });
    await logAction({ user:req.user, action:"Created IC loan request", entityType:"IC Loan", entityId:requestNo, details:`${l.amount} — ${l.borrowerPurpose}` });
    res.status(201).json(await getOne(id));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to create request" }); }
}

// ── Generic partial update (used by Treasury/FC actions from the frontend) ──
export async function updateIcLoan(req, res) {
  try {
    const loan = await getOne(req.params.id);
    if (!loan) return res.status(404).json({ error:"Not found" });
    await saveFields(loan.id, req.body);
    res.json(await getOne(loan.id));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to update request" }); }
}

// ── 2. Accountant approves/rejects (new first review step, order 2) ──
export async function accountantDecide(req, res) {
  try {
    const loan = await getOne(req.params.id);
    if (!loan) return res.status(404).json({ error:"Not found" });
    const { action, reason } = req.body;
    const steps = loan.steps.map(s => s.order===2 ? {...s, status:action==="approve"?"Approved":"Rejected", by:req.user.name, date:new Date().toISOString().split("T")[0]} : s);
    const status = action==="approve" ? "Pending Company Head" : "Rejected";
    await saveFields(loan.id, { steps, status, rejectReason: action==="reject"?reason:undefined });
    await createNotification({
      title: action==="approve" ? "Approved by Accountant" : "Request rejected",
      message:`${loan.requestNo} ${action==="approve"?"moved to Company Head review":"was rejected by Accountant"}`,
      targetRoles: action==="approve" ? ["CompanyHead"] : [], targetEmails:[loan.requestedByEmail], entityId:loan.id,
    });
    await logAction({ user:req.user, action:`Accountant ${action}d request`, entityType:"IC Loan", entityId:loan.requestNo });
    res.json(await getOne(loan.id));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to update" }); }
}

// ── 3. Company Head approves/rejects (order 3) ──
export async function companyHeadDecide(req, res) {
  try {
    const loan = await getOne(req.params.id);
    if (!loan) return res.status(404).json({ error:"Not found" });
    const { action, reason } = req.body;
    const steps = loan.steps.map(s => s.order===3 ? {...s, status:action==="approve"?"Approved":"Rejected", by:req.user.name, date:new Date().toISOString().split("T")[0]} : s);
    const status = action==="approve" ? "Pending Treasury" : "Rejected";
    await saveFields(loan.id, { steps, status, rejectReason: action==="reject"?reason:undefined });
    await createNotification({
      title: action==="approve" ? "Request approved by Company Head" : "Request rejected",
      message:`${loan.requestNo} ${action==="approve"?"moved to Treasury review":"was rejected by Company Head"}`,
      targetRoles: action==="approve" ? ["Treasury"] : [], targetEmails:[loan.requestedByEmail], entityId:loan.id,
    });
    await logAction({ user:req.user, action:`Company Head ${action}d request`, entityType:"IC Loan", entityId:loan.requestNo });
    res.json(await getOne(loan.id));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to update" }); }
}

// ── 4. Treasury decides: assign lender(s) + terms, or reject (order 4) ──
export async function treasuryDecide(req, res) {
  try {
    const loan = await getOne(req.params.id);
    if (!loan) return res.status(404).json({ error:"Not found" });
    const { action, lenders, interestRate, finalRepaymentDate, finalPurpose, remarks, handlingFee, reason } = req.body;

    if (action === "reject") {
      const steps = loan.steps.map(s => s.order===4 ? {...s, status:"Rejected", by:req.user.name, date:new Date().toISOString().split("T")[0]} : s);
      await saveFields(loan.id, { steps, status:"Rejected", rejectReason:reason });
      await createNotification({ title:"Request rejected by Treasury", message:`${loan.requestNo}: ${reason}`, targetEmails:[loan.requestedByEmail], entityId:loan.id });
      await logAction({ user:req.user, action:"Treasury rejected request", entityType:"IC Loan", entityId:loan.requestNo, details:reason });
      return res.json(await getOne(loan.id));
    }

    const sum = lenders.reduce((s,l)=>s+(+l.amount||0),0);
    if (sum !== loan.amount) return res.status(400).json({ error:`Lender amounts must total exactly ${loan.amount} (got ${sum})` });
    if (lenders.some(l=>!l.company)) return res.status(400).json({ error:"Every lender row needs a company" });

    const steps = loan.steps.map(s => s.order===4 ? {...s, status:"Approved", by:req.user.name, date:new Date().toISOString().split("T")[0]} : s);

    const isEditing = !!loan.treasuryDecision;
    const treasuryDecision = {
      lenders, interestRate:+interestRate,
      interestHistory: isEditing
        ? [...loan.treasuryDecision.interestHistory, { rate:+interestRate, fromDate:new Date().toISOString().split("T")[0], setBy:req.user.name, note:"Revised by Treasury" }]
        : [{ rate:+interestRate, fromDate:new Date().toISOString().split("T")[0], setBy:req.user.name }],
      finalRepaymentDate, finalPurpose, remarks, handlingFee:+handlingFee||0,
      decidedBy:req.user.name, decidedDate:new Date().toISOString().split("T")[0],
    };
    const lenderConfirmations = [];
    lenders.forEach(l => {
      lenderConfirmations.push({ company:l.company, amount:l.amount, role:"Accountant", status:"Pending" });
      lenderConfirmations.push({ company:l.company, amount:l.amount, role:"CompanyHead", status:"Pending" });
    });

    await saveFields(loan.id, { steps, treasuryDecision, lenderConfirmations, status:"Pending Lender Confirmation" });
    await createNotification({ title:"Terms set — awaiting lender confirmation", message:`${loan.requestNo} sent to ${lenders.map(l=>l.company).join(", ")} for confirmation`, targetRoles:["CompanyHead","Accountant"], entityId:loan.id });
    await logAction({ user:req.user, action: isEditing ? "Treasury edited lender assignment" : "Treasury approved & assigned lenders", entityType:"IC Loan", entityId:loan.requestNo, details:`Rate ${interestRate}%, lenders: ${lenders.map(l=>`${l.company} ${l.amount}`).join(", ")}` });
    res.json(await getOne(loan.id));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to process treasury decision" }); }
}

// ── 5. Lender company confirms/rejects ──
export async function lenderDecide(req, res) {
  try {
    const loan = await getOne(req.params.id);
    if (!loan) return res.status(404).json({ error:"Not found" });
    const { company, role, action } = req.body;

    const lenderConfirmations = loan.lenderConfirmations.map(c =>
      (c.company===company && c.role===role) ? {...c, status:action==="approve"?"Approved":"Rejected", by:req.user.name, date:new Date().toISOString().split("T")[0]} : c
    );
    const anyRejected = lenderConfirmations.some(c=>c.status==="Rejected");
    const allApproved = lenderConfirmations.length > 0 && lenderConfirmations.every(c=>c.status==="Approved");
    const status = anyRejected ? "Rejected" : allApproved ? "Pending Finance Controller" : "Pending Lender Confirmation";

    await saveFields(loan.id, { lenderConfirmations, status });

    if (anyRejected) {
      await createNotification({ title:"Lender rejected funding", message:`${company} (${role}) rejected ${loan.requestNo} — request cancelled`, targetEmails:[loan.requestedByEmail], targetRoles:["Treasury"], entityId:loan.id });
    } else if (allApproved) {
      await createNotification({ title:"All lenders confirmed — ready for release", message:`${loan.requestNo} awaiting Finance Controller to release payment`, targetRoles:["FinanceController"], entityId:loan.id });
      await logAction({ user:req.user, action:"All lenders confirmed; emailed Finance Controller", entityType:"IC Loan", entityId:loan.requestNo, details:"Simulated email sent to Finance Controller" });
    }
    await logAction({ user:req.user, action:`Lender ${company} (${role}) ${action}d`, entityType:"IC Loan", entityId:loan.requestNo });
    res.json(await getOne(loan.id));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to process lender decision" }); }
}

// ── 6. Finance Controller releases OR rejects the payment — requires bank confirmation to approve ──
export async function releasePayment(req, res) {
  try {
    const loan = await getOne(req.params.id);
    if (!loan) return res.status(404).json({ error:"Not found" });
    const { action, reason, bankConfirmed, bankRef } = req.body;

    if (action === "reject") {
      const financeController = { status:"Rejected", rejectedBy:req.user.name, rejectedDate:new Date().toISOString().split("T")[0], reason };
      await saveFields(loan.id, { financeController, status:"Rejected" });
      await createNotification({ title:"Payment release rejected", message:`${loan.requestNo}: ${reason}`, targetEmails:[loan.requestedByEmail], targetRoles:["Treasury"], entityId:loan.id });
      await logAction({ user:req.user, action:"Finance Controller rejected payment release", entityType:"IC Loan", entityId:loan.requestNo, details:reason });
      return res.json(await getOne(loan.id));
    }

    if (!bankConfirmed) {
      return res.status(400).json({ error:"Bank payment must be confirmed before releasing." });
    }

    const financeController = { status:"Released", releasedBy:req.user.name, releasedDate:new Date().toISOString().split("T")[0], bankConfirmed:true, bankRef: bankRef||null };
    await saveFields(loan.id, { financeController, status:"Active" });
    await createNotification({ title:"Payment released", message:`${loan.requestNo} is now Active — bank payment confirmed`, targetEmails:[loan.requestedByEmail], targetRoles:["Treasury"], entityId:loan.id });
    await logAction({ user:req.user, action:"Finance Controller released payment (bank confirmed)", entityType:"IC Loan", entityId:loan.requestNo, details:`Bank ref: ${bankRef||"—"}` });
    res.json(await getOne(loan.id));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to process payment release" }); }
}

// ── Overdue: add a new rate segment ──
export async function addNewRate(req, res) {
  try {
    const loan = await getOne(req.params.id);
    if (!loan?.treasuryDecision) return res.status(400).json({ error:"No treasury terms set yet" });
    const { rate } = req.body;
    const history = [...loan.treasuryDecision.interestHistory, { rate:+rate, fromDate:new Date().toISOString().split("T")[0], setBy:req.user.name }];
    const treasuryDecision = { ...loan.treasuryDecision, interestRate:+rate, interestHistory:history };
    await saveFields(loan.id, { treasuryDecision });
    await createNotification({ title:"Interest rate updated (overdue loan)", message:`${loan.requestNo} rate changed to ${rate}%`, targetEmails:[loan.requestedByEmail], entityId:loan.id });
    await logAction({ user:req.user, action:"Treasury updated overdue interest rate", entityType:"IC Loan", entityId:loan.requestNo, details:`New rate ${rate}%` });
    res.json(await getOne(loan.id));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to update rate" }); }
}

// ── Either Treasury OR the borrower's own Accountant/CompanyHead can initiate settlement, any time the loan is Active ──
export async function initiateSettle(req, res) {
  try {
    const loan = await getOne(req.params.id);
    if (!loan) return res.status(404).json({ error:"Not found" });
    const { settledDate, arRef, dnRef, attachments } = req.body;
    const role = req.user.role;
    const today = new Date().toISOString().split("T")[0];

    if (role !== "Treasury" && role !== "SuperAdmin") {
      if (req.user.company !== loan.borrowerCompany) {
        return res.status(403).json({ error:"Only Treasury or the borrower's own company can initiate settlement" });
      }
    }

    const settlementSteps = [
      { role:"Accountant", status: role==="Accountant" ? "Approved" : "Pending", by: role==="Accountant" ? req.user.name : undefined, date: role==="Accountant" ? today : undefined },
      { role:"CompanyHead", status: role==="CompanyHead" ? "Approved" : "Pending", by: role==="CompanyHead" ? req.user.name : undefined, date: role==="CompanyHead" ? today : undefined },
      { role:"FinanceController", status:"Pending" },
    ];
    const settlement = { settled:false, settledDate, arRef, dnRef, attachments: attachments || [], steps:settlementSteps, initiatedBy:req.user.name };
    await saveFields(loan.id, { settlement, status:"Pending Settlement" });
    await createNotification({ title:"Settlement initiated", message:`${loan.requestNo} settlement started by ${req.user.name}`, targetRoles:["Treasury","Accountant","CompanyHead"], entityId:loan.id });
    await logAction({ user:req.user, action:`${role} initiated settlement`, entityType:"IC Loan", entityId:loan.requestNo });
    res.json(await getOne(loan.id));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to initiate settlement" }); }
}

// ── Accountant / Company Head / Finance Controller confirm settlement, in order ──
export async function settlementDecide(req, res) {
  try {
    const loan = await getOne(req.params.id);
    if (!loan) return res.status(404).json({ error:"Not found" });
    const { role, action } = req.body;

    const steps = loan.settlement.steps.map(s => s.role===role ? {...s, status:action==="approve"?"Approved":"Rejected", by:req.user.name, date:new Date().toISOString().split("T")[0]} : s);
    const anyRejected = steps.some(s=>s.status==="Rejected");
    const allApproved = steps.every(s=>s.status==="Approved");
    const settlement = { ...loan.settlement, steps, settled: allApproved };
    const status = anyRejected ? "Active" : allApproved ? "Settled" : "Pending Settlement";

    await saveFields(loan.id, { settlement, status });

    if (allApproved) {
      await createNotification({ title:"Loan settled", message:`${loan.requestNo} fully repaid and closed`, targetEmails:[loan.requestedByEmail], entityId:loan.id });
    } else if (anyRejected) {
      await createNotification({ title:"Settlement rejected", message:`${loan.requestNo} settlement rejected by ${role} — loan remains Active`, targetRoles:["Treasury"], entityId:loan.id });
    }
    await logAction({ user:req.user, action:`Settlement ${role} ${action}d`, entityType:"IC Loan", entityId:loan.requestNo });
    res.json(await getOne(loan.id));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to process settlement decision" }); }
}

// ── Bulk upload ──
export async function bulkCreate(req, res) {
  try {
    const { rows } = req.body;
    const created = [];
    const today = new Date().toISOString().split("T")[0];
    for (const r of rows) {
      const id = "ICR"+Date.now()+Math.random().toString(36).slice(2,5);
      const requestNo = await genReqNo();
      const steps = [
        { order:1, role:"TeamMember", company:r.borrowerCompany, status:"Approved", by:req.user.name, date: today },
        { order:2, role:"Accountant", company:r.borrowerCompany, status:"Pending" },
        { order:3, role:"CompanyHead", company:r.borrowerCompany, status:"Pending" },
        { order:4, role:"Treasury", status:"Pending" },
      ];
      await pool.query(
        `INSERT INTO ic_loans
          (id, request_no, borrower_company, amount, borrower_purpose,
           bank_name, bank_account_no, loan_type,
           grant_date, loan_needed_date, requested_repayment_date,
           remarks, attachments, requested_by, requested_by_email, status,
           steps, lender_confirmations, finance_controller, settlement)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, requestNo, r.borrowerCompany, r.amount, r.purpose,
         r.bankName||null, r.bankAccountNo||null, r.loanType||null,
         today, r.loanNeededDate||null, r.requestedRepaymentDate,
         r.remarks||"", "[]", req.user.name, req.user.email, "Pending Accountant Review",
         JSON.stringify(steps), "[]", JSON.stringify({status:"Pending"}), JSON.stringify({settled:false})]
      );
      created.push(requestNo);
    }
    await createNotification({ title:"Bulk requests submitted", message:`${created.length} requests uploaded via Excel template`, targetRoles:["Accountant"] });
    await logAction({ user:req.user, action:`Bulk uploaded ${created.length} IC loan requests`, entityType:"IC Loan", entityId:"bulk" });
    res.status(201).json({ created });
  } catch (err) { console.error(err); res.status(500).json({ error:"Bulk upload failed" }); }
}