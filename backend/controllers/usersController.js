import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";

const NO_COMPANY_ROLES = ["Treasury","FinanceController","GCFO","SuperAdmin"];

const nextEmpId = async () => {
  const [rows] = await pool.query("SELECT emp_id FROM users ORDER BY id DESC LIMIT 1");
  const last = rows[0]?.emp_id ? parseInt(rows[0].emp_id.split("-")[1]) : 0;
  return "EMP-" + String(last+1).padStart(4,"0");
};

export async function getUsers(req, res) {
  const [rows] = await pool.query("SELECT id,emp_id,name,email,role,company,active,created_at FROM users ORDER BY created_at DESC");
  res.json(rows);
}

export async function createUser(req, res) {
  try {
    const { name, email, password, role, company } = req.body;
    const empId = await nextEmpId();
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (emp_id,name,email,password_hash,role,company) VALUES (?,?,?,?,?,?)",
      [empId, name, email, hash, role, NO_COMPANY_ROLES.includes(role) ? null : company]
    );
    res.status(201).json({ id:result.insertId, empId, name, email, role, company, active:true });
  } catch (err) {
    if (err.code==="ER_DUP_ENTRY") return res.status(409).json({ error:"Email already exists" });
    console.error(err); res.status(500).json({ error:"Failed to create user" });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, role, company, active } = req.body;
    await pool.query("UPDATE users SET name=?, role=?, company=?, active=? WHERE id=?",
      [name, role, NO_COMPANY_ROLES.includes(role) ? null : company, active, id]);
    res.json({ ok:true });
  } catch (err) { console.error(err); res.status(500).json({ error:"Failed to update user" }); }
}

export async function deleteUser(req, res) {
  try { await pool.query("DELETE FROM users WHERE id=?", [req.params.id]); res.json({ ok:true }); }
  catch (err) { console.error(err); res.status(500).json({ error:"Failed to delete user" }); }
}