// import { pool } from "../config/db.js";

// export async function getDeposits(req, res) {
//   const [rows] = await pool.query("SELECT * FROM deposits ORDER BY from_date DESC");
//   res.json(rows.map(r => ({
//     id:r.id, company:r.company, bank:r.bank, branch:r.branch, accountNo:r.account_no,
//     currency:r.currency, type:r.type, amount:+r.amount, rate:+r.rate,
//     fromDate:r.from_date, toDate:r.to_date, pledged:!!r.pledged,
//     facilityValue:+r.facility_value, leeway:+r.leeway, purpose:r.purpose,
//   })));
// }

// export async function createDeposit(req, res) {
//   try {
//     const d = req.body;
//     const id = "D"+Date.now();
//     const facilityValue = +d.facilityValue || 0;
//     const leeway = facilityValue ? (+d.amount - facilityValue) : 0;
//     await pool.query(
//       `INSERT INTO deposits (id,company,bank,branch,account_no,currency,type,amount,rate,from_date,to_date,pledged,facility_value,leeway,purpose)
//        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//       [id,d.company,d.bank,d.branch,d.accountNo,d.currency,d.type,d.amount,d.rate,d.fromDate,d.toDate,d.pledged==="true"||d.pledged===true,facilityValue,leeway,d.purpose]
//     );
//     res.status(201).json({ id, ...d, facilityValue, leeway });
//   } catch (err) { console.error(err); res.status(500).json({ error:"Failed to create deposit" }); }
// }

import { pool } from "../config/db.js";

function camelizeDeposit(r) {
  return {
    id:r.id, company:r.company, bank:r.bank, branch:r.branch, accountNo:r.account_no,
    currency:r.currency, type:r.type, amount:+r.amount, rate:+r.rate,
    fromDate:r.from_date, toDate:r.to_date, pledged:!!r.pledged,
    facilityValue:+r.facility_value, leeway:+r.leeway, purpose:r.purpose,
  };
}

export async function getDeposits(req, res) {
  const [rows] = await pool.query("SELECT * FROM deposits ORDER BY from_date DESC");
  res.json(rows.map(camelizeDeposit));
}

export async function createDeposit(req, res) {
  try {
    const d = req.body;
    const id = "D"+Date.now();
    const facilityValue = +d.facilityValue || 0;
    const leeway = facilityValue ? (+d.amount - facilityValue) : 0;
    await pool.query(
      `INSERT INTO deposits (id,company,bank,branch,account_no,currency,type,amount,rate,from_date,to_date,pledged,facility_value,leeway,purpose)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id,d.company,d.bank,d.branch,d.accountNo,d.currency,d.type,d.amount,d.rate,d.fromDate,d.toDate,d.pledged==="true"||d.pledged===true,facilityValue,leeway,d.purpose]
    );
    const [rows] = await pool.query("SELECT * FROM deposits WHERE id=?", [id]);
    res.status(201).json(camelizeDeposit(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to create deposit" }); }
}