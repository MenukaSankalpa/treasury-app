// import { pool } from "../config/db.js";

// export async function getBalances(req, res) {
//   const [rows] = await pool.query("SELECT * FROM balances ORDER BY as_of_date DESC");
//   res.json(rows.map(r => ({
//     id:r.id, company:r.company, bank:r.bank, branch:r.branch, accountNo:r.account_no,
//     accountType:r.account_type, currency:r.currency, balance:+r.balance, asOfDate:r.as_of_date,
//   })));
// }

// export async function saveBalance(req, res) {
//   try {
//     const b = req.body;
//     const id = "B"+Date.now();
//     await pool.query(
//       `INSERT INTO balances (id,company,bank,branch,account_no,account_type,currency,balance,as_of_date)
//        VALUES (?,?,?,?,?,?,?,?,?)`,
//       [id,b.company,b.bank,b.branch,b.accountNo,b.accountType,b.currency,b.balance,b.asOfDate]
//     );
//     res.status(201).json({ id, ...b });
//   } catch (err) { console.error(err); res.status(500).json({ error:"Failed to save balance" }); }
// }

import { pool } from "../config/db.js";

function camelizeBalance(r) {
  return {
    id:r.id, company:r.company, bank:r.bank, branch:r.branch, accountNo:r.account_no,
    accountType:r.account_type, currency:r.currency, balance:+r.balance, asOfDate:r.as_of_date,
  };
}

export async function getBalances(req, res) {
  const [rows] = await pool.query("SELECT * FROM balances ORDER BY as_of_date DESC");
  res.json(rows.map(camelizeBalance));
}

export async function saveBalance(req, res) {
  try {
    const b = req.body;
    const id = "B"+Date.now();
    await pool.query(
      `INSERT INTO balances (id,company,bank,branch,account_no,account_type,currency,balance,as_of_date)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id,b.company,b.bank,b.branch,b.accountNo,b.accountType,b.currency,b.balance,b.asOfDate]
    );
    const [rows] = await pool.query("SELECT * FROM balances WHERE id=?", [id]);
    res.status(201).json(camelizeBalance(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to save balance" }); }
}