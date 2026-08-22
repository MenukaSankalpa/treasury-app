import { createContext, useContext, useState, useEffect } from "react";

const KEY = "treasury_notifications";
const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const notify = ({title, message, targetEmails=[], targetRoles=[], type="info", entityId=null}) => {
    const n = {
      id: "N"+Date.now()+Math.random().toString(36).slice(2,6),
      title, message, targetEmails, targetRoles, type, entityId,
      date: new Date().toISOString(), read: false,
    };
    setItems(prev => [n, ...prev].slice(0,300));
  };

  const visibleTo = (n, user) => {
    if (!user) return false;
    if (user.role === "SuperAdmin" || user.role === "GCFO") return true;
    if (n.targetEmails?.map(e=>e.toLowerCase()).includes(user.email?.toLowerCase())) return true;
    if (n.targetRoles?.includes(user.role)) return true;
    return false;
  };

  const forUser = (user) => items.filter(n => visibleTo(n, user));
  const unreadCount = (user) => forUser(user).filter(n=>!n.read).length;
  const markRead = (id) => setItems(prev => prev.map(n => n.id===id?{...n,read:true}:n));
  const markAllRead = (user) => setItems(prev => prev.map(n => visibleTo(n,user)?{...n,read:true}:n));

  return (
    <NotificationsContext.Provider value={{items, notify, markRead, markAllRead, forUser, unreadCount}}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}