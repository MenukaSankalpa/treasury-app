import { pool } from "../config/db.js";

// Handles NULL, empty string, already-parsed objects/arrays (mysql2 auto-parses
// native JSON columns), comma-separated legacy strings, and malformed JSON.
// This NEVER throws — every possible bad input falls through to the fallback.
function safeParse(val, fallback) {
  if (val === null || val === undefined || val === "") return fallback;
  if (Array.isArray(val) || (typeof val === "object")) return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      // Legacy data stored as a plain comma-separated string
      // (e.g. "Accountant,CompanyHead,Treasury,GCFO") instead of JSON.
      // Convert it defensively instead of crashing.
      return val.split(",").map(s => s.trim()).filter(Boolean);
    }
  }
  return fallback;
}

export async function getPermissions(req, res) {
  try {
    const [pages] = await pool.query("SELECT * FROM page_access");
    const [actions] = await pool.query("SELECT * FROM action_access");
    const pageAccess = {};
    pages.forEach(p => { pageAccess[p.page_key] = safeParse(p.roles, []); });
    const actionAccess = {};
    actions.forEach(a => {
      actionAccess[a.action_key] = {
        roles: safeParse(a.roles, []),
        emails: safeParse(a.emails, []),
      };
    });
    res.json({ pageAccess, actionAccess });
  } catch (err) {
    console.error("getPermissions failed:", err);
    res.status(500).json({ error: "Failed to load permissions" });
  }
}

export async function togglePageRole(req, res) {
  try {
    const { pageKey, role } = req.body;
    const [rows] = await pool.query("SELECT roles FROM page_access WHERE page_key=?", [pageKey]);
    const roles = rows[0] ? safeParse(rows[0].roles, []) : [];
    const has = roles.includes(role);
    const updated = has ? roles.filter(r => r !== role) : [...roles, role];
    await pool.query(
      "INSERT INTO page_access (page_key, roles) VALUES (?,?) ON DUPLICATE KEY UPDATE roles=VALUES(roles)",
      [pageKey, JSON.stringify(updated)]
    );
    res.json({ pageKey, roles: updated });
  } catch (err) {
    console.error("togglePageRole failed:", err);
    res.status(500).json({ error: "Failed to update page access" });
  }
}

export async function toggleActionRole(req, res) {
  try {
    const { actionKey, role } = req.body;
    const [rows] = await pool.query("SELECT roles, emails FROM action_access WHERE action_key=?", [actionKey]);
    const roles = rows[0] ? safeParse(rows[0].roles, []) : [];
    const emails = rows[0] ? safeParse(rows[0].emails, []) : [];
    const has = roles.includes(role);
    const updated = has ? roles.filter(r => r !== role) : [...roles, role];
    await pool.query(
      "INSERT INTO action_access (action_key, roles, emails) VALUES (?,?,?) ON DUPLICATE KEY UPDATE roles=VALUES(roles)",
      [actionKey, JSON.stringify(updated), JSON.stringify(emails)]
    );
    res.json({ actionKey, roles: updated, emails });
  } catch (err) {
    console.error("toggleActionRole failed:", err);
    res.status(500).json({ error: "Failed to update action access" });
  }
}

export async function grantActionEmail(req, res) {
  try {
    const { actionKey, email } = req.body;
    const [rows] = await pool.query("SELECT roles, emails FROM action_access WHERE action_key=?", [actionKey]);
    const roles = rows[0] ? safeParse(rows[0].roles, []) : [];
    const emails = rows[0] ? safeParse(rows[0].emails, []) : [];
    if (!emails.map(e => e.toLowerCase()).includes(email.toLowerCase())) emails.push(email);
    await pool.query(
      "INSERT INTO action_access (action_key, roles, emails) VALUES (?,?,?) ON DUPLICATE KEY UPDATE emails=VALUES(emails)",
      [actionKey, JSON.stringify(roles), JSON.stringify(emails)]
    );
    res.json({ actionKey, roles, emails });
  } catch (err) {
    console.error("grantActionEmail failed:", err);
    res.status(500).json({ error: "Failed to grant email access" });
  }
}

export async function revokeActionEmail(req, res) {
  try {
    const { actionKey, email } = req.body;
    const [rows] = await pool.query("SELECT roles, emails FROM action_access WHERE action_key=?", [actionKey]);
    const roles = rows[0] ? safeParse(rows[0].roles, []) : [];
    const emails = (rows[0] ? safeParse(rows[0].emails, []) : []).filter(e => e.toLowerCase() !== email.toLowerCase());
    await pool.query("UPDATE action_access SET emails=? WHERE action_key=?", [JSON.stringify(emails), actionKey]);
    res.json({ actionKey, roles, emails });
  } catch (err) {
    console.error("revokeActionEmail failed:", err);
    res.status(500).json({ error: "Failed to revoke email access" });
  }
}

export async function resetPermissions(req, res) {
  try {
    const { DEFAULT_PAGE_ACCESS, DEFAULT_ACTION_ACCESS } = await import("./defaultPermissions.js");
    for (const [key, roles] of Object.entries(DEFAULT_PAGE_ACCESS)) {
      await pool.query(
        "INSERT INTO page_access (page_key, roles) VALUES (?,?) ON DUPLICATE KEY UPDATE roles=VALUES(roles)",
        [key, JSON.stringify(roles)]
      );
    }
    for (const [key, rule] of Object.entries(DEFAULT_ACTION_ACCESS)) {
      await pool.query(
        "INSERT INTO action_access (action_key, roles, emails) VALUES (?,?,?) ON DUPLICATE KEY UPDATE roles=VALUES(roles), emails=VALUES(emails)",
        [key, JSON.stringify(rule.roles), JSON.stringify(rule.emails)]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("resetPermissions failed:", err);
    res.status(500).json({ error: "Failed to reset permissions" });
  }
}