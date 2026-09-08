import { createContext, useContext, useState, useEffect } from "react";
import { DEFAULT_PAGE_ACCESS, DEFAULT_ACTION_ACCESS } from "../permissions";
import { permissionsApi } from "../api/treasury";
import { USE_MOCK } from "../config";

const PermissionsContext = createContext(null);

function mergePageAccess(saved) {
  if (!saved) return DEFAULT_PAGE_ACCESS;
  const merged = { ...saved };
  for (const key of Object.keys(DEFAULT_PAGE_ACCESS)) {
    if (!(key in merged)) merged[key] = DEFAULT_PAGE_ACCESS[key];
  }
  return merged;
}

function mergeActionAccess(saved) {
  if (!saved) return DEFAULT_ACTION_ACCESS;
  const merged = { ...saved };
  for (const key of Object.keys(DEFAULT_ACTION_ACCESS)) {
    if (!(key in merged)) merged[key] = DEFAULT_ACTION_ACCESS[key];
  }
  return merged;
}

export function PermissionsProvider({ children }) {
  const [pageAccess, setPageAccess] = useState(DEFAULT_PAGE_ACCESS);
  const [actionAccess, setActionAccess] = useState(DEFAULT_ACTION_ACCESS);
  const [loaded, setLoaded] = useState(false);

  // Load real permissions from the backend on every app start — this is
  // what makes Access Control changes visible to EVERY user's browser,
  // not just the one that made the change.
  useEffect(() => {
    async function load() {
      if (USE_MOCK) {
        setPageAccess(DEFAULT_PAGE_ACCESS);
        setActionAccess(DEFAULT_ACTION_ACCESS);
        setLoaded(true);
        return;
      }
      try {
        const data = await permissionsApi.get();
        setPageAccess(mergePageAccess(data.pageAccess));
        setActionAccess(mergeActionAccess(data.actionAccess));
      } catch (err) {
        console.error("Failed to load permissions from server, using defaults:", err);
        setPageAccess(DEFAULT_PAGE_ACCESS);
        setActionAccess(DEFAULT_ACTION_ACCESS);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

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

  // Every toggle now calls the backend AND updates local state optimistically,
  // so the change is saved for everyone immediately, not just this browser.
  const toggleAccess = async (pageKey, role) => {
    if (role === "SuperAdmin") return;
    const current = pageAccess[pageKey] || [];
    const has = current.includes(role);
    const updated = has ? current.filter(r => r !== role) : [...current, role];
    setPageAccess(prev => ({ ...prev, [pageKey]: updated }));
    try {
      if (!USE_MOCK) await permissionsApi.togglePageRole(pageKey, role);
    } catch (err) {
      console.error("Failed to save page access change:", err);
      setPageAccess(prev => ({ ...prev, [pageKey]: current })); // revert on failure
      alert("Failed to save this permission change. Please try again.");
    }
  };

  const toggleActionRole = async (actionKey, role) => {
    if (role === "SuperAdmin") return;
    const rule = actionAccess[actionKey] || { roles: [], emails: [] };
    const has = rule.roles.includes(role);
    const updatedRoles = has ? rule.roles.filter(r => r !== role) : [...rule.roles, role];
    setActionAccess(prev => ({ ...prev, [actionKey]: { ...rule, roles: updatedRoles } }));
    try {
      if (!USE_MOCK) await permissionsApi.toggleActionRole(actionKey, role);
    } catch (err) {
      console.error("Failed to save action access change:", err);
      setActionAccess(prev => ({ ...prev, [actionKey]: rule })); // revert
      alert("Failed to save this permission change. Please try again.");
    }
  };

  const grantActionEmail = async (actionKey, email) => {
    if (!email) return;
    const rule = actionAccess[actionKey] || { roles: [], emails: [] };
    if (rule.emails.map(e=>e.toLowerCase()).includes(email.toLowerCase())) return;
    const updated = { ...rule, emails: [...rule.emails, email] };
    setActionAccess(prev => ({ ...prev, [actionKey]: updated }));
    try {
      if (!USE_MOCK) await permissionsApi.grantActionEmail(actionKey, email);
    } catch (err) {
      console.error("Failed to grant email access:", err);
      setActionAccess(prev => ({ ...prev, [actionKey]: rule }));
      alert("Failed to save this permission change. Please try again.");
    }
  };

  const revokeActionEmail = async (actionKey, email) => {
    const rule = actionAccess[actionKey] || { roles: [], emails: [] };
    const updated = { ...rule, emails: rule.emails.filter(e=>e.toLowerCase()!==email.toLowerCase()) };
    setActionAccess(prev => ({ ...prev, [actionKey]: updated }));
    try {
      if (!USE_MOCK) await permissionsApi.revokeActionEmail(actionKey, email);
    } catch (err) {
      console.error("Failed to revoke email access:", err);
      setActionAccess(prev => ({ ...prev, [actionKey]: rule }));
      alert("Failed to save this permission change. Please try again.");
    }
  };

  const resetDefaults = async () => {
    setPageAccess(DEFAULT_PAGE_ACCESS);
    setActionAccess(DEFAULT_ACTION_ACCESS);
    try {
      if (!USE_MOCK) await permissionsApi.reset();
    } catch (err) {
      console.error("Failed to reset permissions on server:", err);
      alert("Reset locally, but failed to save to server. Please try again.");
    }
  };

  if (!loaded) {
    return <div style={{padding:40,textAlign:"center",color:"var(--color-text-secondary)"}}>Loading…</div>;
  }

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