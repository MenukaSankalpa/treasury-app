// import { pool } from "../config/db.js";

// export async function getRates(req, res) {
//   const [rows] = await pool.query("SELECT * FROM rates ORDER BY date ASC");
//   res.json(rows);
// }

// export async function saveRate(req, res) {
//   try {
//     const r = req.body;
//     await pool.query(
//       `INSERT INTO rates (date,awplr,tb3m,tb6m,tb12m,tbond2y,tbond5y,tbond10y,usdlkr) VALUES (?,?,?,?,?,?,?,?,?)
//        ON DUPLICATE KEY UPDATE awplr=VALUES(awplr),tb3m=VALUES(tb3m),tb6m=VALUES(tb6m),tb12m=VALUES(tb12m),
//        tbond2y=VALUES(tbond2y),tbond5y=VALUES(tbond5y),tbond10y=VALUES(tbond10y),usdlkr=VALUES(usdlkr)`,
//       [r.date,r.awplr,r.tb3m,r.tb6m,r.tb12m,r.tbond2y,r.tbond5y,r.tbond10y,r.usdlkr]
//     );
//     res.status(201).json(r);
//   } catch (err) { console.error(err); res.status(500).json({ error:"Failed to save rates" }); }
// }

import { pool } from "../config/db.js";

function camelizeRate(r) {
  return {
    date: r.date,
    awplr: +r.awplr, tb3m: +r.tb3m, tb6m: +r.tb6m, tb12m: +r.tb12m,
    tbond2y: +r.tbond2y, tbond5y: +r.tbond5y, tbond10y: +r.tbond10y,
    usdlkr: +r.usdlkr,
  };
}

export async function getRates(req, res) {
  const [rows] = await pool.query("SELECT * FROM rates ORDER BY date ASC");
  res.json(rows.map(camelizeRate));
}

export async function saveRate(req, res) {
  try {
    const r = req.body;
    await pool.query(
      `INSERT INTO rates (date,awplr,tb3m,tb6m,tb12m,tbond2y,tbond5y,tbond10y,usdlkr) VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE awplr=VALUES(awplr),tb3m=VALUES(tb3m),tb6m=VALUES(tb6m),tb12m=VALUES(tb12m),
       tbond2y=VALUES(tbond2y),tbond5y=VALUES(tbond5y),tbond10y=VALUES(tbond10y),usdlkr=VALUES(usdlkr)`,
      [r.date,r.awplr,r.tb3m,r.tb6m,r.tb12m,r.tbond2y,r.tbond5y,r.tbond10y,r.usdlkr]
    );
    res.status(201).json(camelizeRate({...r}));
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to save rates" }); }
}