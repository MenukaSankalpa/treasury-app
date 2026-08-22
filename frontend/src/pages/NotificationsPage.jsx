import { useNotifications } from "../context/NotificationsContext";
import { useAuth } from "../context/AuthContext";
import { GlassCard, PageHeader, Badge, S } from "../components/UI";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { forUser, markRead, markAllRead } = useNotifications();
  const items = forUser(user);

  return (
    <div>
      <PageHeader title="Notifications">
        <button style={S.btnGhost} onClick={()=>markAllRead(user)}>Mark all as read</button>
      </PageHeader>
      <GlassCard>
        {items.length === 0 && <div style={{padding:24,color:"var(--color-text-secondary)",textAlign:"center"}}>No notifications yet</div>}
        {items.map(n => (
          <div key={n.id} onClick={()=>markRead(n.id)} style={{
            display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12,
            padding:"12px 6px", borderBottom:"0.5px solid var(--color-border-tertiary)",
            cursor:"pointer", background: n.read?"transparent":"var(--color-background-info)", borderRadius:8,
          }}>
            <div>
              <div style={{fontWeight:600,fontSize:13,color:"var(--color-text-primary)"}}>{n.title}</div>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:2}}>{n.message}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              {!n.read && <Badge type="blue">New</Badge>}
              <div style={{fontSize:11,color:"var(--color-text-secondary)",marginTop:4}}>{new Date(n.date).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}