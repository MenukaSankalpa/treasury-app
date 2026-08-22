import { pool } from "../config/db.js";

export async function getPermissions(req, res) {
  const [pages] = await pool.query("SELECT * FROM page_access");
  const [actions] = await pool.query("SELECT * FROM action_access");
  const pageAccess = {};
  pages.forEach(p => pageAccess[p.page_key] = JSON.parse(p.roles));
  const actionAccess = {};
  actions.forEach(a => actionAccess[a.action_key] = { roles: JSON.parse(a.roles), emails: JSON.parse(a.emails) });
  res.json({ pageAccess, actionAccess });
}

export async function togglePageRole(req, res) {
  const { pageKey, role } = req.body;
  const [rows] = await pool.query("SELECT roles FROM page_access WHERE page_key=?", [pageKey]);
  const roles = rows[0] ? JSON.parse(rows[0].roles) : [];
  const has = roles.includes(role);
  const updated = has ? roles.filter(r=>r!==role) : [...roles, role];
  await pool.query("INSERT INTO page_access (page_key, roles) VALUES (?,?) ON DUPLICATE KEY UPDATE roles=VALUES(roles)", [pageKey, JSON.stringify(updated)]);
  res.json({ pageKey, roles: updated });
}

export async function toggleActionRole(req, res) {
  const { actionKey, role } = req.body;
  const [rows] = await pool.query("SELECT roles, emails FROM action_access WHERE action_key=?", [actionKey]);
  const roles = rows[0] ? JSON.parse(rows[0].roles) : [];
  const emails = rows[0] ? JSON.parse(rows[0].emails) : [];
  const has = roles.includes(role);
  const updated = has ? roles.filter(r=>r!==role) : [...roles, role];
  await pool.query("INSERT INTO action_access (action_key, roles, emails) VALUES (?,?,?) ON DUPLICATE KEY UPDATE roles=VALUES(roles)", [actionKey, JSON.stringify(updated), JSON.stringify(emails)]);
  res.json({ actionKey, roles: updated, emails });
}

export async function grantActionEmail(req, res) {
  const { actionKey, email } = req.body;
  const [rows] = await pool.query("SELECT roles, emails FROM action_access WHERE action_key=?", [actionKey]);
  const roles = rows[0] ? JSON.parse(rows[0].roles) : [];
  const emails = rows[0] ? JSON.parse(rows[0].emails) : [];
  if (!emails.map(e=>e.toLowerCase()).includes(email.toLowerCase())) emails.push(email);
  await pool.query("INSERT INTO action_access (action_key, roles, emails) VALUES (?,?,?) ON DUPLICATE KEY UPDATE emails=VALUES(emails)", [actionKey, JSON.stringify(roles), JSON.stringify(emails)]);
  res.json({ actionKey, roles, emails });
}

export async function revokeActionEmail(req, res) {
  const { actionKey, email } = req.body;
  const [rows] = await pool.query("SELECT roles, emails FROM action_access WHERE action_key=?", [actionKey]);
  const roles = rows[0] ? JSON.parse(rows[0].roles) : [];
  const emails = (rows[0] ? JSON.parse(rows[0].emails) : []).filter(e=>e.toLowerCase()!==email.toLowerCase());
  await pool.query("UPDATE action_access SET emails=? WHERE action_key=?", [JSON.stringify(emails), actionKey]);
  res.json({ actionKey, roles, emails });
}

export async function resetPermissions(req, res) {
  // Re-run the same defaults as seed.js
  const { DEFAULT_PAGE_ACCESS, DEFAULT_ACTION_ACCESS } = await import("./defaultPermissions.js");
  for (const [key, roles] of Object.entries(DEFAULT_PAGE_ACCESS)) {
    await pool.query("INSERT INTO page_access (page_key, roles) VALUES (?,?) ON DUPLICATE KEY UPDATE roles=VALUES(roles)", [key, JSON.stringify(roles)]);
  }
  for (const [key, rule] of Object.entries(DEFAULT_ACTION_ACCESS)) {
    await pool.query("INSERT INTO action_access (action_key, roles, emails) VALUES (?,?,?) ON DUPLICATE KEY UPDATE roles=VALUES(roles), emails=VALUES(emails)", [key, JSON.stringify(rule.roles), JSON.stringify(rule.emails)]);
  }
  res.json({ ok:true });
}