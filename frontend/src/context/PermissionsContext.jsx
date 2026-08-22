import { createContext, useContext, useState, useEffect } from "react";
import { DEFAULT_PAGE_ACCESS, DEFAULT_ACTION_ACCESS } from "../permissions";

const PAGE_KEY = "treasury_permissions";
const ACTION_KEY = "treasury_action_permissions";
const PermissionsContext = createContext(null);

// Merges a saved page-access object with the current code defaults by
// UNIONING role arrays per page, rather than one replacing the other.
// This means any role added to DEFAULT_PAGE_ACCESS in code is always
// respected immediately, even for users with an older cached copy —
// no more manual localStorage.removeItem() needed after a permissions
// change. A role explicitly REMOVED via Access Control (SuperAdmin
// toggling it off) stays removed, since that's a deliberate saved
// state, not a stale gap — see toggleAccess/toggleActionRole below,
// which write the FULL resulting array back to localStorage, so future
// reads see the deliberate removal as the "saved" value to merge from.
function mergePageAccess(saved) {
  const merged = {};
  const allKeys = new Set([...Object.keys(DEFAULT_PAGE_ACCESS), ...Object.keys(saved || {})]);
  for (const key of allKeys) {
    const defaultRoles = DEFAULT_PAGE_ACCESS[key] || [];
    const savedRoles = saved?.[key];
    merged[key] = savedRoles
      ? [...new Set([...defaultRoles, ...savedRoles])]
      : defaultRoles;
  }
  return merged;
}

function mergeActionAccess(saved) {
  const merged = {};
  const allKeys = new Set([...Object.keys(DEFAULT_ACTION_ACCESS), ...Object.keys(saved || {})]);
  for (const key of allKeys) {
    const defaultRule = DEFAULT_ACTION_ACCESS[key] || { roles: [], emails: [] };
    const savedRule = saved?.[key];
    merged[key] = savedRule
      ? { roles: [...new Set([...defaultRule.roles, ...(savedRule.roles || [])])], emails: savedRule.emails || [] }
      : defaultRule;
  }
  return merged;
}

export function PermissionsProvider({ children }) {
  const [pageAccess, setPageAccess] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PAGE_KEY));
      return mergePageAccess(saved);
    } catch {
      return DEFAULT_PAGE_ACCESS;
    }
  });

  const [actionAccess, setActionAccess] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ACTION_KEY));
      return mergeActionAccess(saved);
    } catch {
      return DEFAULT_ACTION_ACCESS;
    }
  });

  useEffect(() => { localStorage.setItem(PAGE_KEY, JSON.stringify(pageAccess)); }, [pageAccess]);
  useEffect(() => { localStorage.setItem(ACTION_KEY, JSON.stringify(actionAccess)); }, [actionAccess]);

  const canAccess = (role, pageKey) => {
    if (role === "SuperAdmin") return true;
    return pageAccess[pageKey]?.includes(role) ?? false;
  };

  const firstAllowedPage = (role) =>
    Object.keys(pageAccess).find(key => canAccess(role, key)) || "dashboard";

  const canDoAction = (user, actionKey) => {
    if (!user) return false;
    if (user.role === "SuperAdmin") return true;
    const rule = actionAccess[actionKey];
    if (!rule) return false;
    if (rule.roles?.includes(user.role)) return true;
    if (rule.emails?.map(e=>e.toLowerCase()).includes(user.email?.toLowerCase())) return true;
    return false;
  };

  const toggleAccess = (pageKey, role) => {
    if (role === "SuperAdmin") return;
    setPageAccess(prev => {
      const current = prev[pageKey] || [];
      const has = current.includes(role);
      return { ...prev, [pageKey]: has ? current.filter(r => r !== role) : [...current, role] };
    });
  };

  const toggleActionRole = (actionKey, role) => {
    if (role === "SuperAdmin") return;
    setActionAccess(prev => {
      const rule = prev[actionKey] || { roles:[], emails:[] };
      const has = rule.roles.includes(role);
      return { ...prev, [actionKey]: { ...rule, roles: has ? rule.roles.filter(r=>r!==role) : [...rule.roles, role] } };
    });
  };

  const grantActionEmail = (actionKey, email) => {
    if (!email) return;
    setActionAccess(prev => {
      const rule = prev[actionKey] || { roles:[], emails:[] };
      if (rule.emails.map(e=>e.toLowerCase()).includes(email.toLowerCase())) return prev;
      return { ...prev, [actionKey]: { ...rule, emails:[...rule.emails, email] } };
    });
  };

  const revokeActionEmail = (actionKey, email) => {
    setActionAccess(prev => {
      const rule = prev[actionKey] || { roles:[], emails:[] };
      return { ...prev, [actionKey]: { ...rule, emails: rule.emails.filter(e=>e.toLowerCase()!==email.toLowerCase()) } };
    });
  };

  const resetDefaults = () => {
    setPageAccess(DEFAULT_PAGE_ACCESS);
    setActionAccess(DEFAULT_ACTION_ACCESS);
  };

  return (
    <PermissionsContext.Provider value={{
      pageAccess, canAccess, firstAllowedPage, toggleAccess,
      actionAccess, canDoAction, toggleActionRole, grantActionEmail, revokeActionEmail,
      resetDefaults,
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used inside PermissionsProvider");
  return ctx;
}