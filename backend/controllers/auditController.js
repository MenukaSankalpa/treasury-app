import { pool } from "../config/db.js";

export async function logAction({ user, action, entityType, entityId, details }) {
  const id = "A"+Date.now()+Math.random().toString(36).slice(2,6);
  await pool.query(
    "INSERT INTO audit_log (id,user_name,user_email,user_role,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?,?)",
    [id, user?.name, user?.email, user?.role, action, entityType, entityId, details||null]
  );
}

export async function getAuditLog(req, res) {
  const [rows] = await pool.query("SELECT * FROM audit_log ORDER BY date DESC LIMIT 1000");
  res.json(rows.map(r => ({
    id:r.id, date:r.date, userName:r.user_name, userEmail:r.user_email, userRole:r.user_role,
    action:r.action, entityType:r.entity_type, entityId:r.entity_id, details:r.details,
  })));
}