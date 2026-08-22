import { useMemo, useState } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { COMPANIES, COMPANY_PALETTE } from "../../constants";
import { fmtM, fmtFull, fmtPct, wtdRate, latestBalances, TODAY } from "../../utils";
import { GlassCard, KpiGlass, Badge, Table, PageHeader, Field, S } from "../../components/UI";

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

export default function DashboardAll({loans, deposits, icLoans, rates, balances}) {
  const [preset, setPreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [company, setCompany] = useState("");

  const {from, to} = preset === "custom" ? {from:customFrom, to:customTo} : presetToRange(preset);
  const isDateFiltered = !!(from || to);
  const isFiltered = isDateFiltered || !!company;

  const loansF = useMemo(() => loans.filter(l =>
    (!isDateFiltered || inRange(l.facilityDate, from, to)) && (!company || l.company === company)
  ), [loans, from, to, isDateFiltered, company]);

  const depositsF = useMemo(() => deposits.filter(d =>
    (!isDateFiltered || inRange(d.fromDate, from, to)) && (!company || d.company === company)
  ), [deposits, from, to, isDateFiltered, company]);

  const icLoansF = useMemo(() => icLoans.filter(l =>
    (!isDateFiltered || inRange(l.grantDate, from, to)) && (!company || l.borrowerCompany === company || l.treasuryDecision?.lenders?.some(x=>x.company===company))
  ), [icLoans, from, to, isDateFiltered, company]);

  const balancesF = useMemo(() => balances.filter(b =>
    (!isDateFiltered || inRange(b.asOfDate, from, to)) && (!company || b.company === company)
  ), [balances, from, to, isDateFiltered, company]);

  const activeLoans = loansF.filter(l => (l.status || "Active") === "Active");
  const totalDebt = activeLoans.reduce((s,l) => s+l.outstanding,0);
  const usdRate = rates.length ? rates[rates.length-1].usdlkr : 299;
  const totalDep = depositsF.reduce((s,d) => s+(d.currency==="USD"?d.amount*usdRate:d.amount),0);
  const netDebt = totalDebt - totalDep;
  const avgRate = wtdRate(activeLoans);
  const latest = rates.length ? rates[rates.length-1] : {};
  const activeIC = icLoansF.filter(l=>l.status==="Active").length;
  const pendingLoans = loansF.filter(l => l.status==="Pending Company Head" || l.status==="Pending Treasury Approval").length;

  // ── This month's repayment obligation — respects the company filter above ──
  const monthlyRepayment = useMemo(() => activeLoans.reduce((s,l) => {
    let cap = 0;
    if (l.repayFreq === "Monthly") cap = l.repayAmt;
    else if (l.repayFreq === "Quarterly") cap = l.repayAmt / 3;
    const int = l.outstanding * (l.rate/100/12);
    return s + cap + int;
  }, 0), [activeLoans]);

  const latestBal = useMemo(() => latestBalances(balancesF), [balancesF]);
  const toLkr = b => b.currency==="USD" ? b.balance*usdRate : b.balance;
  const currentTotal = latestBal.filter(b=>b.accountType==="Current").reduce((s,b)=>s+toLkr(b),0);
  const savingsTotal = latestBal.filter(b=>b.accountType==="Savings").reduce((s,b)=>s+toLkr(b),0);
  const overdraftTotal = latestBal.filter(b=>b.accountType==="Overdraft").reduce((s,b)=>s+toLkr(b),0);
  const totalCash = currentTotal + savingsTotal;

  const companiesInScope = company ? [company] : COMPANIES;

  const cashByCompanyType = useMemo(() => companiesInScope.map(c => {
    const rows = latestBal.filter(b=>b.company===c);
    return {
      company: c,
      Current: Math.round(rows.filter(b=>b.accountType==="Current").reduce((s,b)=>s+toLkr(b),0)/1e6),
      Savings: Math.round(rows.filter(b=>b.accountType==="Savings").reduce((s,b)=>s+toLkr(b),0)/1e6),
      Overdraft: Math.round(rows.filter(b=>b.accountType==="Overdraft").reduce((s,b)=>s+toLkr(b),0)/1e6),
    };
  }).filter(x => x.Current || x.Savings || x.Overdraft), [latestBal, usdRate, companiesInScope]);

  const debtByCo = useMemo(() => companiesInScope.map(c => ({name:c,value:activeLoans.filter(l=>l.company===c).reduce((s,l)=>s+l.outstanding,0)})).filter(x=>x.value>0),[activeLoans, companiesInScope]);

  // ── Monthly repayment by company — separate KPI-supporting breakdown ──
  const repaymentByCompany = useMemo(() => companiesInScope.map(c => {
    const rows = activeLoans.filter(l=>l.company===c);
    const val = rows.reduce((s,l) => {
      let cap = 0;
      if (l.repayFreq === "Monthly") cap = l.repayAmt;
      else if (l.repayFreq === "Quarterly") cap = l.repayAmt / 3;
      const int = l.outstanding * (l.rate/100/12);
      return s + cap + int;
    }, 0);
    return {company:c, value: Math.round(val/1e6)};
  }).filter(x=>x.value>0), [activeLoans, companiesInScope]);

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

  const pillBase = { padding:"6px 14px", borderRadius:20, border:"none", fontSize:12.5, fontWeight:500, cursor:"pointer", transition:"all 0.15s ease" };

  return (
    <div>
      <PageHeader title="Treasury Dashboard — All Companies" />

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

          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Company</span>
            <select
              value={company}
              onChange={e => setCompany(e.target.value)}
              style={{
                padding:"7px 14px", borderRadius:20, border:"1px solid var(--color-border-secondary)",
                background: company ? "#185FA5" : "var(--color-background-primary)",
                color: company ? "#fff" : "var(--color-text-primary)",
                fontSize:12.5, fontWeight:500, cursor:"pointer",
              }}
            >
              <option value="">All companies</option>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {isFiltered && (
            <button onClick={() => { setPreset("all"); setCustomFrom(""); setCustomTo(""); setCompany(""); }} style={{...pillBase, background:"transparent", border:"1px solid var(--color-border-secondary)", color:"var(--color-text-secondary)"}}>
              ✕ Clear all
            </button>
          )}
        </div>
      </GlassCard>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:16}}>
        <KpiGlass label="Total Debt" value={fmtM(totalDebt)} sub={`${activeLoans.length} facilities`} accent="#185FA5" icon="ti-credit-card" />
        <KpiGlass label="Total Deposits" value={fmtM(totalDep)} sub="LKR equivalent" accent="#0F6E56" icon="ti-building-bank" />
        <KpiGlass label="Net Debt" value={fmtM(netDebt)} accent="#993C1D" icon="ti-scale" />
        <KpiGlass label="Monthly Repayment" value={fmtFull(monthlyRepayment)} sub={company ? `${company} — this month` : "Group total, this month"} accent="#A32D2D" icon="ti-calendar-due" />
        <KpiGlass label="Wtd. Avg. Rate" value={fmtPct(avgRate)} sub="All borrowings" accent="#534AB7" icon="ti-percentage" />
        <KpiGlass label="AWPLR" value={latest.awplr ? fmtPct(latest.awplr) : "—"} sub={latest.date} accent="#BA7517" icon="ti-chart-line" />
        <KpiGlass label="USD / LKR" value={latest.usdlkr || "—"} sub={latest.date} accent="#993556" icon="ti-currency-dollar" />
        <KpiGlass label="Active IC Loans" value={activeIC} sub="Intercompany" accent="#3B6D11" icon="ti-arrows-exchange" />
        <KpiGlass label="Pending Approvals" value={pendingLoans} sub="Loan facilities" accent="#0F6E56" icon="ti-clock" />
      </div>

      <div style={{marginBottom:6, fontSize:12, fontWeight:600, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em"}}>
        Group cash balance summary
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:20}}>
        <KpiGlass label="Current Account Balance" value={fmtFull(currentTotal)} sub={company || "Across all companies"} accent="#185FA5" icon="ti-building-bank" />
        <KpiGlass label="Savings Account Balance" value={fmtFull(savingsTotal)} sub={company || "Across all companies"} accent="#0F6E56" icon="ti-pig-money" />
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
        <GlassCard title="Debt by company">
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={debtByCo} cx="50%" cy="50%" innerRadius={48} outerRadius={88} dataKey="value" nameKey="name" label={e=>`${e.name} ${(e.percent*100).toFixed(0)}%`} labelLine={false} style={{fontSize:10}}>
                {debtByCo.map((_,i) => <Cell key={i} fill={COMPANY_PALETTE[i%15]} />)}
              </Pie>
              <Tooltip formatter={v => fmtM(v)} />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {!company && repaymentByCompany.length > 0 && (
        <GlassCard title="Monthly repayment by company (LKR Mn)" style={{marginBottom:16}}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={repaymentByCompany}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
              <XAxis dataKey="company" tick={{fontSize:11}} />
              <YAxis tick={{fontSize:11}} />
              <Tooltip formatter={v => `LKR ${v}M`} />
              <Bar dataKey="value" fill="#A32D2D" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      <GlassCard title="Cash position by company — Current vs Savings vs Overdraft (LKR Mn)" style={{marginBottom:16}}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={cashByCompanyType} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
            <XAxis dataKey="company" tick={{fontSize:11}} />
            <YAxis tick={{fontSize:11}} />
            <Tooltip formatter={v => `LKR ${v}M`} />
            <Legend />
            <Bar dataKey="Current" fill="#185FA5" radius={[4,4,0,0]} />
            <Bar dataKey="Savings" fill="#0F6E56" radius={[4,4,0,0]} />
            <Bar dataKey="Overdraft" fill="#A32D2D" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>

      <GlassCard title="Active facilities">
        <Table
          cols={[
            {key:"company",label:"Company"},
            {key:"type",label:"Type"},
            {key:"bank",label:"Bank"},
            {key:"outstanding",label:"Outstanding",render:v=>fmtM(v)},
            {key:"rate",label:"Rate",render:v=>fmtPct(v)},
            {key:"interestType",label:"Type",render:v=><Badge type={v==="Fixed"?"blue":v==="Variable"?"amber":"gray"}>{v}</Badge>},
            {key:"maturityDate",label:"Matures"},
          ]}
          rows={activeLoans.slice(0,8)}
        />
      </GlassCard>
    </div>
  );
}