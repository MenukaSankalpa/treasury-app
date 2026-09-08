import { PAGES, ROLES, ACTIONS } from "../permissions";
import { usePermissions } from "../context/PermissionsContext";
import { GlassCard, PageHeader, S } from "../components/UI";
import { useState } from "react";

export default function AccessControlPage() {
  const {
    pageAccess, toggleAccess,
    actionAccess, toggleActionRole, grantActionEmail, revokeActionEmail,
    resetDefaults,
  } = usePermissions();

  const [emailInputs, setEmailInputs] = useState({});
  const [resetting, setResetting] = useState(false);

  const checkboxCell = (checked, onClick, disabled=false) => (
    <td style={{textAlign:"center", padding:"8px 6px", borderBottom:"1px solid var(--color-border-secondary)"}}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={onClick}
        style={{width:16, height:16, cursor: disabled ? "not-allowed" : "pointer"}}
      />
    </td>
  );

  const selectableRoles = ROLES.filter(r => r !== "SuperAdmin");

  return (
    <div>
      <PageHeader title="Access Control">
        <button
          style={S.btn("#A32D2D")}
          disabled={resetting}
          onClick={async () => {
            if (!window.confirm("Reset all page and action permissions to their defaults? This cannot be undone.")) return;
            setResetting(true);
            try { await resetDefaults(); } finally { setResetting(false); }
          }}
        >
          {resetting ? "Resetting…" : "Reset to defaults"}
        </button>
      </PageHeader>

      <GlassCard title="Page visibility — which roles can see each page" style={{marginBottom:20}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
            <thead>
              <tr>
                <th style={{textAlign:"left", padding:"8px 10px", borderBottom:"2px solid var(--color-border-secondary)"}}>Page</th>
                <th style={{padding:"8px 6px", borderBottom:"2px solid var(--color-border-secondary)", color:"var(--color-text-secondary)"}}>SuperAdmin</th>
                {selectableRoles.map(role => (
                  <th key={role} style={{padding:"8px 6px", borderBottom:"2px solid var(--color-border-secondary)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.03em"}}>
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PAGES.map(({key, label}) => {
                const roles = pageAccess[key] || [];
                return (
                  <tr key={key}>
                    <td style={{padding:"8px 10px", borderBottom:"1px solid var(--color-border-secondary)", fontWeight:500}}>{label}</td>
                    {checkboxCell(true, () => {}, true)}
                    {selectableRoles.map(role => (
                      <td key={role} style={{textAlign:"center", padding:"8px 6px", borderBottom:"1px solid var(--color-border-secondary)"}}>
                        <input
                          type="checkbox"
                          checked={roles.includes(role)}
                          onChange={() => toggleAccess(key, role)}
                          style={{width:16, height:16, cursor:"pointer"}}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{fontSize:12, color:"var(--color-text-secondary)", marginTop:10}}>
          SuperAdmin always has access to every page and cannot be restricted. Uncheck a role to hide that page from users with that role.
        </p>
      </GlassCard>

      <GlassCard title="Action permissions — which roles (or specific people) can perform each action">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
            <thead>
              <tr>
                <th style={{textAlign:"left", padding:"8px 10px", borderBottom:"2px solid var(--color-border-secondary)"}}>Action</th>
                {selectableRoles.map(role => (
                  <th key={role} style={{padding:"8px 6px", borderBottom:"2px solid var(--color-border-secondary)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.03em"}}>
                    {role}
                  </th>
                ))}
                <th style={{textAlign:"left", padding:"8px 10px", borderBottom:"2px solid var(--color-border-secondary)"}}>Specific people (by email)</th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map(({key, label}) => {
                const rule = actionAccess[key] || { roles:[], emails:[] };
                return (
                  <tr key={key}>
                    <td style={{padding:"8px 10px", borderBottom:"1px solid var(--color-border-secondary)", fontWeight:500}}>{label}</td>
                    {selectableRoles.map(role => (
                      <td key={role} style={{textAlign:"center", padding:"8px 6px", borderBottom:"1px solid var(--color-border-secondary)"}}>
                        <input
                          type="checkbox"
                          checked={rule.roles?.includes(role) || false}
                          onChange={() => toggleActionRole(key, role)}
                          style={{width:16, height:16, cursor:"pointer"}}
                        />
                      </td>
                    ))}
                    <td style={{padding:"8px 10px", borderBottom:"1px solid var(--color-border-secondary)"}}>
                      <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:6}}>
                        {(rule.emails || []).map(email => (
                          <span key={email} style={{display:"flex", alignItems:"center", gap:4, background:"var(--color-background-secondary)", borderRadius:6, padding:"2px 8px", fontSize:12}}>
                            {email}
                            <button
                              onClick={() => revokeActionEmail(key, email)}
                              style={{background:"none", border:"none", cursor:"pointer", color:"var(--color-text-danger)", fontSize:12, padding:0}}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                      <div style={{display:"flex", gap:6}}>
                        <input
                          type="email"
                          placeholder="name@company.com"
                          value={emailInputs[key] || ""}
                          onChange={e => setEmailInputs({...emailInputs, [key]: e.target.value})}
                          style={{flex:1, minWidth:160, padding:"5px 8px", borderRadius:6, border:"0.5px solid var(--color-border-secondary)", fontSize:12}}
                        />
                        <button
                          style={{...S.btnGhost, padding:"4px 10px", fontSize:12}}
                          onClick={() => {
                            const email = (emailInputs[key] || "").trim();
                            if (!email) return;
                            grantActionEmail(key, email);
                            setEmailInputs({...emailInputs, [key]: ""});
                          }}
                        >
                          + Add
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{fontSize:12, color:"var(--color-text-secondary)", marginTop:10}}>
          SuperAdmin can always perform every action. A person's email grants them access to that specific action regardless of their role.
        </p>
      </GlassCard>
    </div>
  );
}