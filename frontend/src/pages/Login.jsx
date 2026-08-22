import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { USE_MOCK } from "../config";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(135deg, #0A1628 0%, #132743 100%)", fontFamily:"var(--font-sans)",
    }}>
      <div className="glass-card" style={{
        width:"100%", maxWidth:400, background:"rgba(255,255,255,0.92)", padding:"36px 32px",
      }}>
        <div style={{textAlign:"center", marginBottom:28}}>
          <div style={{
            width:48, height:48, borderRadius:12, background:"#0A1628", margin:"0 auto 14px",
            display:"flex", alignItems:"center", justifyContent:"center", color:"#5DCAA5", fontWeight:700, fontSize:18,
          }}>
            CHL
          </div>
          <div style={{fontSize:18, fontWeight:600, color:"var(--color-text-primary)"}}>Treasury Module</div>
          <div style={{fontSize:13, color:"var(--color-text-secondary)", marginTop:4}}>Sign in to continue</div>
        </div>

        {USE_MOCK && (
          <div style={{background:"var(--color-background-info)", color:"var(--color-text-info)", padding:"9px 12px", borderRadius:8, fontSize:12, marginBottom:18, lineHeight:1.5}}>
            <strong>Mock mode</strong> — try <code>admin@chlgroup.com</code> / <code>Admin@123</code>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", display:"block", marginBottom:6}}>Email</label>
            <input
              type="email" required value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="you@chlgroup.com"
              style={{width:"100%", padding:"10px 12px", border:"0.5px solid var(--color-border-secondary)", borderRadius:8, fontSize:14, boxSizing:"border-box"}}
            />
          </div>
          <div style={{marginBottom:22}}>
            <label style={{fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", display:"block", marginBottom:6}}>Password</label>
            <input
              type="password" required value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••"
              style={{width:"100%", padding:"10px 12px", border:"0.5px solid var(--color-border-secondary)", borderRadius:8, fontSize:14, boxSizing:"border-box"}}
            />
          </div>

          {error && (
            <div style={{background:"var(--color-background-danger)", color:"var(--color-text-danger)", padding:"9px 12px", borderRadius:8, fontSize:13, marginBottom:16}}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={submitting}
            style={{
              width:"100%", padding:"11px", borderRadius:8, border:"none",
              background:"#0A1628", color:"#fff", fontSize:14, fontWeight:500,
              cursor:submitting?"default":"pointer", opacity:submitting?0.7:1,
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}