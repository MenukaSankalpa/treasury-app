import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query("SELECT * FROM users WHERE email=? AND active=TRUE", [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const payload = { id:user.id, empId:user.emp_id, name:user.name, email:user.email, role:user.role, company:user.company };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "12h" });
    res.json({ token, user: payload });
  } catch (err) {
    console.error(err); res.status(500).json({ error:"Login failed" });
  }
}

export async function me(req, res) { res.json(req.user); }