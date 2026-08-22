import { useState } from "react";
import { useAudit } from "../context/AuditContext";
import { GlassCard, Table, PageHeader, Badge } from "../components/UI";

export default function AuditLogPage() {
  const { entries } = useAudit();
  const [filterUser, setFilterUser] = useState("");
  const users = [...new Set(entries.map(e=>e.userEmail))].filter(Boolean);
  const rows = filterUser ? entries.filter(e=>e.userEmail===filterUser) : entries;
  const selectStyle = {padding:"6px 10px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",fontSize:13,background:"var(--color-background-primary)",color:"var(--color-text-primary)"};

  return (
    <div>
      <PageHeader title="Audit Log" />
      <GlassCard style={{marginBottom:16, display:"flex", gap:10}}>
        <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} style={selectStyle}>
          <option value="">All users</option>
          {users.map(u=><option key={u} value={u}>{u}</option>)}
        </select>
      </GlassCard>
      <GlassCard>
        <Table
          cols={[
            {key:"date",label:"Timestamp",render:v=>new Date(v).toLocaleString()},
            {key:"userName",label:"User"},
            {key:"userRole",label:"Role",render:v=><Badge type="blue">{v}</Badge>},
            {key:"action",label:"Action"},
            {key:"entityType",label:"Entity"},
            {key:"entityId",label:"Ref"},
            {key:"details",label:"Details"},
          ]}
          rows={rows}
        />
      </GlassCard>
    </div>
  );
}