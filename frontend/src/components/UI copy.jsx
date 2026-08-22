export const S = {
  card: {background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,padding:"16px 20px"},
  row: {display:"flex",alignItems:"center",gap:12},
  label: {fontSize:12,color:"var(--color-text-secondary)",marginBottom:4,display:"block",fontWeight:500},
  input: {width:"100%",boxSizing:"border-box"},
  btn: (c) => ({padding:"7px 16px",borderRadius:8,border:`0.5px solid ${c}`,background:c,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}),
  btnGhost: {padding:"7px 16px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",background:"transparent",color:"var(--color-text-primary)",cursor:"pointer",fontSize:13},
};

export function KPI({label, value, sub, accent}) {
  return (
    <div style={{...S.card, borderTop:`3px solid ${accent}`}}>
      <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
      <div style={{fontSize:22,fontWeight:500,color:"var(--color-text-primary)"}}>{value}</div>
      {sub && <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:3}}>{sub}</div>}
    </div>
  );
}

export function Badge({children, type="gray"}) {
  const map = {
    green:{bg:"var(--color-background-success)",text:"var(--color-text-success)"},
    red:{bg:"var(--color-background-danger)",text:"var(--color-text-danger)"},
    amber:{bg:"var(--color-background-warning)",text:"var(--color-text-warning)"},
    blue:{bg:"var(--color-background-info)",text:"var(--color-text-info)"},
    gray:{bg:"var(--color-background-secondary)",text:"var(--color-text-secondary)"},
  };
  const c = map[type] || map.gray;
  return <span style={{background:c.bg,color:c.text,padding:"2px 9px",borderRadius:100,fontSize:11,fontWeight:500,whiteSpace:"nowrap"}}>{children}</span>;
}

function THead({cols}) {
  return (
    <thead>
      <tr style={{borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
        {cols.map(c => (
          <th key={c.key} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Table({cols, rows, onRow}) {
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <THead cols={cols} />
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} style={{padding:"32px",textAlign:"center",color:"var(--color-text-secondary)"}}>No records</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} onClick={() => onRow && onRow(row)}
              style={{borderBottom:"0.5px solid var(--color-border-tertiary)",cursor:onRow?"pointer":"default"}}
              onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {cols.map(c => (
                <td key={c.key} style={{padding:"10px 12px",color:"var(--color-text-primary)",whiteSpace:c.nowrap?"nowrap":"normal"}}>
                  {c.render ? c.render(row[c.key], row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({title, onClose, children, wide}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:16,width:"100%",maxWidth:wide?800:600,maxHeight:"88vh",overflow:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.18)"}}>
        <div style={{padding:"16px 20px",borderBottom:"0.5px solid var(--color-border-tertiary)",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"var(--color-background-primary)",zIndex:2}}>
          <span style={{fontWeight:500,fontSize:15,color:"var(--color-text-primary)"}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"var(--color-text-secondary)",padding:"0 4px"}}>✕</button>
        </div>
        <div style={{padding:"20px"}}>{children}</div>
      </div>
    </div>
  );
}

export function Field({label, type="text", value, onChange, options, half}) {
  const base = {width:"100%",padding:"7px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,fontSize:13,background:"var(--color-background-primary)",color:"var(--color-text-primary)",boxSizing:"border-box"};
  return (
    <div style={{marginBottom:14,width:half?"calc(50% - 6px)":undefined}}>
      <label style={S.label}>{label}</label>
      {type === "select" ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={base}>
          <option value="">Select…</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} style={{...base,fontFamily:"inherit",resize:"vertical"}} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} style={base} />
      )}
    </div>
  );
}

export function FormRow({children}) {
  return <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{children}</div>;
}

export function PageHeader({title, children}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{margin:0,fontSize:18,fontWeight:500,color:"var(--color-text-primary)"}}>{title}</h2>
      <div style={{display:"flex",gap:8}}>{children}</div>
    </div>
  );
}

export function TabBar({tabs, active, onChange}) {
  return (
    <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding:"7px 14px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",
          background:active===t.key?"var(--color-background-info)":"transparent",
          color:active===t.key?"var(--color-text-info)":"var(--color-text-secondary)",
          cursor:"pointer",fontSize:13,fontWeight:active===t.key?500:400
        }}>{t.label}</button>
      ))}
    </div>
  );
}