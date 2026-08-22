import { useMemo, useState } from "react";
import {
  BarChart, Bar, Cell,
  ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { fmtM, fmtFull, fmtPct, wtdRate, latestBalances, TODAY } from "../../utils";
import { GlassCard, KpiGlass, Badge, Table, PageHeader, Field, S } from "../../components/UI";
import { useAuth } from "../../context/AuthContext";

const PRESETS = [
  {key:"all", label:"All time"},
  {key:"30d", label:"30D"},
  {key:"90d", label:"90D"},
  {key:"ytd", label:"YTD"},
  {key:"custom", label:"Custom"},
];

function presetToRange(preset) {
  const end = new Date(TODAY);
  let start = null;
  if (preset === "30d") { start = new Date(TODAY); start.setDate(start.getDate()-30); }
  else if (preset === "90d") { start = new Date(TODAY); start.setDate(start.getDate()-90); }
  else if (preset === "ytd") { start = new Date(TODAY.getFullYear(), 0, 1); }
  return {
    from: start ? start.toISOString().split("T")[0] : "",
    to: preset === "all" ? "" : end.toISOString().split("T")[0],
  };
}

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

export default function DashboardCompany({loans, deposits, icLoans, rates, balances}) {
  const { user } = useAuth();
  const [preset, setPreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const {from, to} = preset === "custom" ? {from:customFrom, to:customTo} : presetToRange(preset);
  const isDateFiltered = !!(from || to);

  // Hard scope — every dataset filtered to the logged-in user's own company first.
  const loansCo = useMemo(() => loans.filter(l => l.company === user.company), [loans, user.company]);
  const depositsCo = useMemo(() => deposits.filter(d => d.company === user.company), [deposits, user.company]);
  const icLoansCo = useMemo(() => icLoans.filter(l => l.borrowerCompany === user.company || l.treasuryDecision?.lenders?.some(x=>x.company===user.company)), [icLoans, user.company]);
  const balancesCo = useMemo(() => balances.filter(b => b.company === user.company), [balances, user.company]);

  const loansF = useMemo(() => isDateFiltered ? loansCo.filter(l => inRange(l.facilityDate, from, to)) : loansCo, [loansCo, from, to, isDateFiltered]);
  const depositsF = useMemo(() => isDateFiltered ? depositsCo.filter(d => inRange(d.fromDate, from, to)) : depositsCo, [depositsCo, from, to, isDateFiltered]);
  const icLoansF = useMemo(() => isDateFiltered ? icLoansCo.filter(l => inRange(l.grantDate, from, to)) : icLoansCo, [icLoansCo, from, to, isDateFiltered]);
  const balancesF = useMemo(() => isDateFiltered ? balancesCo.filter(b => inRange(b.asOfDate, from, to)) : balancesCo, [balancesCo, from, to, isDateFiltered]);

  const activeLoans = loansF.filter(l => (l.status || "Active") === "Active");
  const totalDebt = activeLoans.reduce((s,l) => s+l.outstanding,0);
  const usdRate = rates.length ? rates[rates.length-1].usdlkr : 299;
  const totalDep = depositsF.reduce((s,d) => s+(d.currency==="USD"?d.amount*usdRate:d.amount),0);
  const netDebt = totalDebt - totalDep;
  const avgRate = wtdRate(activeLoans);
  const latest = rates.length ? rates[rates.length-1] : {};
  const activeIC = icLoansF.filter(l=>l.status==="Active").length;
  const pendingLoans = loansF.filter(l => l.status==="Pending Company Head" || l.status==="Pending Treasury Approval").length;

  // ── This month's repayment obligation (capital + interest) across active facilities ──
  const monthlyRepayment = useMemo(() => activeLoans.reduce((s,l) => {
    let cap = 0;
    if (l.repayFreq === "Monthly") cap = l.repayAmt;
    else if (l.repayFreq === "Quarterly") cap = l.repayAmt / 3; // averaged across the quarter
    const int = l.outstanding * (l.rate/100/12);
    return s + cap + int;
  }, 0), [activeLoans]);

  const latestBal = useMemo(() => latestBalances(balancesF), [balancesF]);
  const toLkr = b => b.currency==="USD" ? b.balance*usdRate : b.balance;
  const currentTotal = latestBal.filter(b=>b.accountType==="Current").reduce((s,b)=>s+toLkr(b),0);
  const savingsTotal = latestBal.filter(b=>b.accountType==="Savings").reduce((s,b)=>s+toLkr(b),0);
  const overdraftTotal = latestBal.filter(b=>b.accountType==="Overdraft").reduce((s,b)=>s+toLkr(b),0);
  const totalCash = currentTotal + savingsTotal;

  const ladder = useMemo(() => Array.from({length:12},(_,i) => {
    const d = new Date(TODAY); d.setMonth(d.getMonth()+i+1);
    const mo = d.toLocaleDateString("en-US",{month:"short",year:"2-digit"});
    const cap = activeLoans.reduce((s,l) => {
      if (l.repayFreq==="Bullet") return s;
      if (l.repayFreq==="Monthly") return s+l.repayAmt;
      if (l.repayFreq==="Quarterly" && (i+1)%3===0) return s+l.repayAmt;
      return s;
    },0);
    const int = activeLoans.reduce((s,l) => s+l.outstanding*(l.rate/100/12),0);
    return {mo, cap:Math.round(cap/1e6), int:Math.round(int/1e6)};
  }),[activeLoans]);

  const loanTypeSplit = useMemo(() => {
    const map = new Map();
    activeLoans.forEach(l => map.set(l.type, (map.get(l.type)||0) + l.outstanding));
    return [...map.entries()].map(([type,value]) => ({type, value}));
  }, [activeLoans]);

  const pillBase = { padding:"6px 14px", borderRadius:20, border:"none", fontSize:12.5, fontWeight:500, cursor:"pointer", transition:"all 0.15s ease" };
  const typeColors = ["#185FA5","#0F6E56","#993C1D","#534AB7","#BA7517","#A32D2D"];

  return (
    <div>
      <PageHeader title={`Dashboard — ${user.company}`} />

      <GlassCard style={{marginBottom:16}}>
        <div style={{display:"flex", gap:20, alignItems:"center", flexWrap:"wrap"}}>
          <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Period</span>
            <div style={{display:"flex", gap:4, background:"rgba(0,0,0,0.04)", borderRadius:22, padding:3}}>
              {PRESETS.map(p => (
                <button key={p.key} onClick={() => setPreset(p.key)} style={{...pillBase, background: preset===p.key ? "#185FA5" : "transparent", color: preset===p.key ? "#fff" : "var(--color-text-secondary)"}}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {preset === "custom" && (
            <div style={{display:"flex", gap:10}}>
              <div style={{minWidth:140}}><Field label="From" type="date" value={customFrom} onChange={setCustomFrom} /></div>
              <div style={{minWidth:140}}><Field label="To" type="date" value={customTo} onChange={setCustomTo} /></div>
            </div>
          )}
          {isDateFiltered && (
            <button onClick={() => { setPreset("all"); setCustomFrom(""); setCustomTo(""); }} style={{...pillBase, background:"transparent", border:"1px solid var(--color-border-secondary)", color:"var(--color-text-secondary)"}}>
              ✕ Clear
            </button>
          )}
        </div>
      </GlassCard>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:16}}>
        <KpiGlass label="Total Debt" value={fmtM(totalDebt)} sub={`${activeLoans.length} active facilities`} accent="#185FA5" icon="ti-credit-card" />
        <KpiGlass label="Total Deposits" value={fmtM(totalDep)} sub="LKR equivalent" accent="#0F6E56" icon="ti-building-bank" />
        <KpiGlass label="Net Debt" value={fmtM(netDebt)} accent="#993C1D" icon="ti-scale" />
        <KpiGlass label="Monthly Repayment" value={fmtFull(monthlyRepayment)} sub="Capital + interest, this month" accent="#A32D2D" icon="ti-calendar-due" />
        <KpiGlass label="Wtd. Avg. Rate" value={fmtPct(avgRate)} sub="Active borrowings" accent="#534AB7" icon="ti-percentage" />
        <KpiGlass label="Active IC Loans" value={activeIC} sub="Intercompany" accent="#3B6D11" icon="ti-arrows-exchange" />
        <KpiGlass label="Pending Approvals" value={pendingLoans} sub="Loan facilities" accent="#BA7517" icon="ti-clock" />
      </div>

      <div style={{marginBottom:6, fontSize:12, fontWeight:600, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em"}}>
        Cash balance summary
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:20}}>
        <KpiGlass label="Current Account Balance" value={fmtFull(currentTotal)} accent="#185FA5" icon="ti-building-bank" />
        <KpiGlass label="Savings Account Balance" value={fmtFull(savingsTotal)} accent="#0F6E56" icon="ti-pig-money" />
        <KpiGlass label="Total Cash Position" value={fmtFull(totalCash)} sub="Current + Savings" accent="#534AB7" icon="ti-wallet" />
        <KpiGlass label="Overdrawn Balance" value={fmtFull(Math.abs(overdraftTotal))} sub={overdraftTotal<0 ? "Net overdraft" : "No overdraft"} accent="#A32D2D" icon="ti-alert-triangle" />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:16,marginBottom:16}}>
        <GlassCard title="Monthly repayment ladder — capital + interest (LKR Mn)">
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={ladder}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
              <XAxis dataKey="mo" tick={{fontSize:11}} />
              <YAxis tick={{fontSize:11}} />
              <Tooltip formatter={v => `LKR ${v}M`} />
              <Legend />
              <Bar dataKey="cap" name="Capital" stackId="a" fill="#185FA5" />
              <Bar dataKey="int" name="Interest" stackId="a" fill="#0F6E56" radius={[4,4,0,0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </GlassCard>
        <GlassCard title="Debt by loan type">
          {loanTypeSplit.length === 0 ? (
            <div style={{padding:24, textAlign:"center", color:"var(--color-text-secondary)", fontSize:13}}>No active facilities</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={loanTypeSplit} layout="vertical" margin={{left:10}}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{fontSize:11}} tickFormatter={v=>fmtM(v)} />
                <YAxis type="category" dataKey="type" tick={{fontSize:11}} width={110} />
                <Tooltip formatter={v => fmtM(v)} />
                <Bar dataKey="value" radius={[0,4,4,0]}>
                  {loanTypeSplit.map((_,i) => <Cell key={i} fill={typeColors[i % typeColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>

      <GlassCard title="All facilities">
        <Table
          cols={[
            {key:"type",label:"Type"},
            {key:"bank",label:"Bank"},
            {key:"outstanding",label:"Outstanding",render:v=>fmtM(v)},
            {key:"rate",label:"Rate",render:v=>fmtPct(v)},
            {key:"status",label:"Status",render:v=><Badge type={v==="Active"?"green":v==="Rejected"?"red":v==="Pending Company Head"?"blue":"amber"}>{v||"Active"}</Badge>},
            {key:"maturityDate",label:"Matures"},
          ]}
          rows={loansF.slice(0,8)}
        />
      </GlassCard>
    </div>
  );
}