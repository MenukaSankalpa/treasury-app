import { createContext, useContext, useState, useEffect } from "react";
import { USE_MOCK } from "../config";
import { mockLogin } from "../mockUsers";
import { authApi } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("treasury_token");
    const cachedUser = localStorage.getItem("treasury_user");

    if (!token) { setLoading(false); return; }
    if (cachedUser) setUser(JSON.parse(cachedUser));

    if (USE_MOCK) {
      setLoading(false);
      return;
    }

    authApi.me()
      .then(u => setUser(u))
      .catch(() => {
        localStorage.removeItem("treasury_token");
        localStorage.removeItem("treasury_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { token, user } = USE_MOCK
      ? mockLogin(email, password)
      : await authApi.login(email, password);

    localStorage.setItem("treasury_token", token);
    localStorage.setItem("treasury_user", JSON.stringify(user));
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("treasury_token");
    localStorage.removeItem("treasury_user");
    setUser(null);
  };

  const isSuperAdmin = user?.role === "SuperAdmin";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}