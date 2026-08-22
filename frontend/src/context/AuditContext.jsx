import { createContext, useContext, useState, useEffect } from "react";

const KEY = "treasury_audit_log";
const AuditContext = createContext(null);

export function AuditProvider({ children }) {
  const [entries, setEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(entries)); }, [entries]);

  const logAction = ({user, action, entityType, entityId, details}) => {
    const e = {
      id:"A"+Date.now()+Math.random().toString(36).slice(2,6),
      date:new Date().toISOString(),
      userName:user?.name, userEmail:user?.email, userRole:user?.role,
      action, entityType, entityId, details,
    };
    setEntries(prev => [e, ...prev].slice(0,1000));
  };

  return (
    <AuditContext.Provider value={{entries, logAction}}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be used inside AuditProvider");
  return ctx;
}