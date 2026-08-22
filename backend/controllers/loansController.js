import { pool } from "../config/db.js";

function safeJSON(val, fallback) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return fallback; } }
  return val;
}

// Accepts a full ISO datetime, a plain YYYY-MM-DD string, a Date object, or
// empty/undefined, and always returns a MySQL-safe 'YYYY-MM-DD' string or null.
function toDateOnly(val) {
  if (!val) return null;
  if (typeof val === "string") {
    if (!val.trim()) return null;
    return val.includes("T") ? val.split("T")[0] : val;
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split("T")[0];
  }
  return null;
}

// Coerces any incoming value to a safe number for DECIMAL columns.
// Empty string, undefined, null, or NaN all become 0 rather than
// crashing the query or silently inserting NaN as a string.
function toNum(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

// Coerces to a safe string for VARCHAR/TEXT columns — empty string stays
// empty (not null), since these are often required display fields.
function toStr(val) {
  return val === null || val === undefined ? "" : String(val);
}

function camelizeLoan(r) {
  return {
    id:r.id, company:r.company, type:r.type, bank:r.bank, bankAccountNo:r.bank_account_no, currency:r.currency,
    facilityAmt:+r.facility_amt, outstanding:+r.outstanding, interestType:r.interest_type,
    rate:+r.rate, spread:+r.spread_pct, awplr:+r.awplr,
    facilityDate:r.facility_date, maturityDate:r.maturity_date, repayFreq:r.repay_freq, repayAmt:+r.repay_amt,
    security:r.security, purpose:r.purpose, status:r.status, cashBacked:!!r.cash_backed,
    requestedBy:r.requested_by, requestedByEmail:r.requested_by_email,
    attachments: safeJSON(r.attachments, []), editHistory: safeJSON(r.edit_history, []),
    rejectReason: r.reject_reason,
    accountantDecidedBy: r.accountant_decided_by, accountantDecidedDate: r.accountant_decided_date,
    companyHeadDecidedBy: r.company_head_decided_by, companyHeadDecidedDate: r.company_head_decided_date,
  };
}

export async function getLoans(req, res) {
  const [rows] = await pool.query("SELECT * FROM loans ORDER BY created_at DESC");
  res.json(rows.map(camelizeLoan));
}

export async function createLoan(req, res) {
  try {
    const l = req.body;
    const id = "L"+Date.now();
    const role = req.user.role;
    const today = new Date().toISOString().split("T")[0];

    // Accountant adding their own request skips the review step entirely —
    // they ARE the reviewer, so their own submission goes straight to
    // Company Head. TeamMember's submission needs Accountant review first.
    const status = role === "Accountant" ? "Pending Company Head" : "Pending Accountant Review";
    const accountantDecidedBy = role === "Accountant" ? req.user.name : null;
    const accountantDecidedDate = role === "Accountant" ? today : null;

    await pool.query(
      `INSERT INTO loans
        (id,company,type,bank,bank_account_no,currency,facility_amt,outstanding,interest_type,rate,spread_pct,awplr,
         facility_date,maturity_date,repay_freq,repay_amt,security,purpose,status,cash_backed,
         requested_by,requested_by_email,attachments,edit_history,accountant_decided_by,accountant_decided_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, toStr(l.company), toStr(l.type), toStr(l.bank), l.bankAccountNo||null, toStr(l.currency),
       toNum(l.facilityAmt), toNum(l.outstanding), toStr(l.interestType),
       toNum(l.rate), toNum(l.spread), toNum(l.awplr),
       toDateOnly(l.facilityDate), toDateOnly(l.maturityDate), toStr(l.repayFreq), toNum(l.repayAmt),
       toStr(l.security), toStr(l.purpose),
       status, false, l.requestedBy||null, l.requestedByEmail||null,
       JSON.stringify(l.attachments||[]), JSON.stringify([]), accountantDecidedBy, accountantDecidedDate]
    );
    const [rows] = await pool.query("SELECT * FROM loans WHERE id=?", [id]);
    res.status(201).json(camelizeLoan(rows[0]));
  } catch (err) {
    console.error("createLoan failed:", err);
    res.status(500).json({ error:"Failed to create loan", detail: err.sqlMessage || err.message });
  }
}

// ── Accountant reviews (new first step) ──
export async function decideAccountant(req, res) {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;
    const status = action === "approve" ? "Pending Company Head" : "Rejected";
    await pool.query(
      "UPDATE loans SET status=?, accountant_decided_by=?, accountant_decided_date=CURDATE(), reject_reason=? WHERE id=?",
      [status, req.user.name, action==="reject" ? (reason||null) : null, id]
    );
    const [rows] = await pool.query("SELECT * FROM loans WHERE id=?", [id]);
    res.json(camelizeLoan(rows[0]));
  } catch (err) {
    console.error("decideAccountant failed:", err);
    res.status(500).json({ error:"Failed to update loan", detail: err.sqlMessage || err.message });
  }
}

// ── Company Head approves/rejects (unchanged logic, now second step) ──
export async function decideCompanyHead(req, res) {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;
    const status = action === "approve" ? "Pending Treasury Approval" : "Rejected";
    await pool.query(
      "UPDATE loans SET status=?, company_head_decided_by=?, company_head_decided_date=CURDATE(), reject_reason=? WHERE id=?",
      [status, req.user.name, action==="reject" ? (reason||null) : null, id]
    );
    const [rows] = await pool.query("SELECT * FROM loans WHERE id=?", [id]);
    res.json(camelizeLoan(rows[0]));
  } catch (err) {
    console.error("decideCompanyHead failed:", err);
    res.status(500).json({ error:"Failed to update loan", detail: err.sqlMessage || err.message });
  }
}

// // ── Company Head approves/rejects ──
// export async function decideCompanyHead(req, res) {
//   try {
//     const { id } = req.params;
//     const { action, reason } = req.body;
//     const status = action === "approve" ? "Pending Treasury Approval" : "Rejected";
//     await pool.query(
//       "UPDATE loans SET status=?, company_head_decided_by=?, company_head_decided_date=CURDATE(), reject_reason=? WHERE id=?",
//       [status, req.user.name, action==="reject" ? (reason||null) : null, id]
//     );
//     const [rows] = await pool.query("SELECT * FROM loans WHERE id=?", [id]);
//     res.json(camelizeLoan(rows[0]));
//   } catch (err) {
//     console.error("decideCompanyHead failed:", err);
//     res.status(500).json({ error:"Failed to update loan", detail: err.sqlMessage || err.message });
//   }
// }

// ── Treasury approves/rejects (final) ──
export async function decideLoan(req, res) {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;
    const status = action === "approve" ? "Active" : "Rejected";
    await pool.query("UPDATE loans SET status=?, reject_reason=? WHERE id=?", [status, action==="reject"?(reason||null):null, id]);
    const [rows] = await pool.query("SELECT * FROM loans WHERE id=?", [id]);
    res.json(camelizeLoan(rows[0]));
  } catch (err) {
    console.error("decideLoan failed:", err);
    res.status(500).json({ error:"Failed to update loan", detail: err.sqlMessage || err.message });
  }
}

// ── Treasury edits any field before final approval ──
export async function updateLoan(req, res) {
  try {
    const { id } = req.params;
    const [existingRows] = await pool.query("SELECT * FROM loans WHERE id=?", [id]);
    if (!existingRows[0]) return res.status(404).json({ error:"Not found" });
    const existing = camelizeLoan(existingRows[0]);
    const l = req.body;

    const newEditHistory = [...existing.editHistory, {
      by: toStr(req.user.name), role: toStr(req.user.role), date: new Date().toISOString().split("T")[0],
      changes: toStr(l.changesSummary) || "Edited by Treasury",
    }];

    await pool.query(
      `UPDATE loans SET
        bank=?, bank_account_no=?, currency=?, facility_amt=?, outstanding=?, interest_type=?, rate=?, spread_pct=?,
        facility_date=?, maturity_date=?, repay_freq=?, repay_amt=?, security=?, purpose=?, attachments=?, edit_history=?
       WHERE id=?`,
      [toStr(l.bank), l.bankAccountNo||null, toStr(l.currency), toNum(l.facilityAmt), toNum(l.outstanding),
       toStr(l.interestType), toNum(l.rate), toNum(l.spread),
       toDateOnly(l.facilityDate), toDateOnly(l.maturityDate), toStr(l.repayFreq), toNum(l.repayAmt),
       toStr(l.security), toStr(l.purpose),
       JSON.stringify(l.attachments||[]), JSON.stringify(newEditHistory), id]
    );
    const [rows] = await pool.query("SELECT * FROM loans WHERE id=?", [id]);
    res.json(camelizeLoan(rows[0]));
  } catch (err) {
    console.error("updateLoan failed:", err);
    res.status(500).json({ error:"Failed to update loan", detail: err.sqlMessage || err.message });
  }
}