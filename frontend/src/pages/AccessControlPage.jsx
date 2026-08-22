import { useState, useEffect } from "react";
import { usePermissions } from "../context/PermissionsContext";
import { PAGES, ROLES, ACTIONS } from "../permissions";
import { GlassCard, PageHeader, Badge, S } from "../components/UI";
import { usersApi } from "../api/users";
import { MOCK_USERS } from "../mockUsers";
import { USE_MOCK } from "../config";

export default function AccessControlPage() {
  const {
    pageAccess, toggleAccess,
    actionAccess, toggleActionRole, grantActionEmail, revokeActionEmail,
    resetDefaults,
  } = usePermissions();

  const editablePages = PAGES.filter(p => p.key !== "access" && p.key !== "users");
  const [allUsers, setAllUsers] = useState([]);
  const [pickEmail, setPickEmail] = useState({}); // actionKey -> selected email in the dropdown

  useEffect(() => {
    if (USE_MOCK) {
      setAllUsers(MOCK_USERS.map(({password, ...u}) => u));
    } else {
      usersApi.list().then(setAllUsers).catch(() => setAllUsers([]));
    }
  }, []);

  const grant = (actionKey) => {
    const email = pickEmail[actionKey];
    if (!email) return;
    grantActionEmail(actionKey, email);
    setPickEmail({...pickEmail, [actionKey]: ""});
  };

  const selectStyle = {padding:"6px 10px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",fontSize:13,background:"var(--color-background-primary)",color:"var(--color-text-primary)"};

  return (
    <div>
      <PageHeader title="Access Control">
        <button style={S.btnGhost} onClick={resetDefaults}>Reset to defaults</button>
      </PageHeader>

      <GlassCard title="Page access — which roles can see each page" style={{marginBottom:16}}>
        <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 18px"}}>
          SuperAdmin always has full access. "User Management" and "Access Control" are permanently SuperAdmin-only.
        </p>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:13}}>
            <thead>
              <tr>
                <th style={{textAlign:"left",padding:"10px 12px",color:"var(--color-text-secondary)",fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em"}}>Page</th>
                {ROLES.map(r => (
                  <th key={r} style={{padding:"10px 12px",textAlign:"center",color:"var(--color-text-secondary)",fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em"}}>{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editablePages.map(p => (
                <tr key={p.key} style={{borderTop:"0.5px solid var(--color-border-tertiary)"}}>
                  <td style={{padding:"10px 12px",fontWeight:500,color:"var(--color-text-primary)"}}>{p.label}</td>
                  {ROLES.map(r => {
                    const checked = r === "SuperAdmin" ? true : (pageAccess[p.key]?.includes(r) ?? false);
                    return (
                      <td key={r} style={{textAlign:"center",padding:"10px 12px"}}>
                        <input type="checkbox" checked={checked} disabled={r === "SuperAdmin"}
                          onChange={() => toggleAccess(p.key, r)}
                          style={{width:16,height:16,cursor:r==="SuperAdmin"?"default":"pointer"}} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard title="Action permissions — who can use each 'create' button">
        <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 18px"}}>
          Each action is allowed for the checked roles by default. You can also grant it to a specific
          person by email — useful when one individual needs access their role wouldn't normally have.
        </p>

        {ACTIONS.map(action => {
          const rule = actionAccess[action.key] || { roles:[], emails:[] };
          return (
            <div key={action.key} style={{borderTop:"0.5px solid var(--color-border-tertiary)", padding:"16px 0"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontWeight:600,fontSize:14,color:"var(--color-text-primary)"}}>{action.label}</div>
                <Badge type="gray">{PAGES.find(p=>p.key===action.page)?.label}</Badge>
              </div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>By role</div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                  {ROLES.map(r => (
                    <label key={r} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"var(--color-text-primary)",cursor:r==="SuperAdmin"?"default":"pointer"}}>
                      <input type="checkbox"
                        checked={r==="SuperAdmin" ? true : rule.roles.includes(r)}
                        disabled={r==="SuperAdmin"}
                        onChange={()=>toggleActionRole(action.key, r)}
                        style={{width:15,height:15}} />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div style={{fontSize:11,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>Individually granted</div>
                <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                  <select
                    value={pickEmail[action.key] || ""}
                    onChange={e=>setPickEmail({...pickEmail, [action.key]: e.target.value})}
                    style={selectStyle}
                  >
                    <option value="">Select a user…</option>
                    {allUsers.map(u => (
                      <option key={u.email} value={u.email}>{u.name} — {u.email} ({u.role})</option>
                    ))}
                  </select>
                  <button style={S.btn("#185FA5")} onClick={()=>grant(action.key)}>Grant access</button>
                </div>
                {rule.emails.length === 0 ? (
                  <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>No individual grants.</div>
                ) : (
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {rule.emails.map(email => {
                      const u = allUsers.find(x=>x.email.toLowerCase()===email.toLowerCase());
                      return (
                        <div key={email} style={{display:"flex",alignItems:"center",gap:6,background:"var(--color-background-info)",borderRadius:20,padding:"4px 6px 4px 12px",fontSize:12,color:"var(--color-text-info)"}}>
                          {u ? `${u.name} (${email})` : email}
                          <button onClick={()=>revokeActionEmail(action.key, email)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-info)",fontSize:14,padding:"0 4px",lineHeight:1}}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </GlassCard>
    </div>
  );
}