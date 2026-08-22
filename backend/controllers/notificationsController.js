import { pool } from "../config/db.js";

export async function createNotification({ title, message, targetEmails=[], targetRoles=[], type="info", entityId=null }) {
  const id = "N"+Date.now()+Math.random().toString(36).slice(2,6);
  await pool.query(
    "INSERT INTO notifications (id,title,message,target_emails,target_roles,type,entity_id) VALUES (?,?,?,?,?,?,?)",
    [id, title, message, JSON.stringify(targetEmails), JSON.stringify(targetRoles), type, entityId]
  );
}

export async function getNotifications(req, res) {
  const { role, email } = req.user;
  const [rows] = await pool.query("SELECT * FROM notifications ORDER BY date DESC LIMIT 300");
  const visible = rows.filter(n => {
    if (role==="SuperAdmin" || role==="GCFO") return true;
    const emails = JSON.parse(n.target_emails||"[]");
    const roles = JSON.parse(n.target_roles||"[]");
    return emails.map(e=>e.toLowerCase()).includes(email.toLowerCase()) || roles.includes(role);
  }).map(n => ({
    id:n.id, title:n.title, message:n.message, type:n.type, entityId:n.entity_id,
    read:!!n.is_read, date:n.date,
  }));
  res.json(visible);
}

export async function markRead(req, res) {
  await pool.query("UPDATE notifications SET is_read=TRUE WHERE id=?", [req.params.id]);
  res.json({ ok:true });
}

export async function markAllRead(req, res) {
  const { role, email } = req.user;
  const [rows] = await pool.query("SELECT id, target_emails, target_roles FROM notifications WHERE is_read=FALSE");
  const ids = rows.filter(n => {
    if (role==="SuperAdmin" || role==="GCFO") return true;
    const emails = JSON.parse(n.target_emails||"[]");
    const roles = JSON.parse(n.target_roles||"[]");
    return emails.map(e=>e.toLowerCase()).includes(email.toLowerCase()) || roles.includes(role);
  }).map(n=>n.id);
  if (ids.length) await pool.query(`UPDATE notifications SET is_read=TRUE WHERE id IN (${ids.map(()=>"?").join(",")})`, ids);
  res.json({ ok:true });
}