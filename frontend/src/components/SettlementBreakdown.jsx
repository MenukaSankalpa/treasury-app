import { fmtFull, calcSettlementAmount } from "../utils";

export default function SettlementBreakdown({loan}) {
  const { principal, interest, handlingFee, total } = calcSettlementAmount(loan);
  return (
    <div style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
      <div style={{fontSize:11,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600,marginBottom:10}}>
        Settlement amount breakdown
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        <Row label="Principal" value={fmtFull(principal)} />
        <Row label="Accrued interest to date" value={fmtFull(interest)} />
        <Row label="Handling fee" value={fmtFull(handlingFee)} />
        <div style={{height:1,background:"var(--color-border-tertiary)",margin:"4px 0"}} />
        <Row label="Total settlement amount" value={fmtFull(total)} bold />
      </div>
    </div>
  );
}

function Row({label, value, bold}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",fontSize: bold?14:13, fontWeight: bold?700:400, color: bold?"var(--color-text-primary)":"var(--color-text-secondary)"}}>
      <span>{label}</span>
      <span style={{color:"var(--color-text-primary)"}}>{value}</span>
    </div>
  );
}