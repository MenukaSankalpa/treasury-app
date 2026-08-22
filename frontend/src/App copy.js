import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const COMPANIES = ["CHL","MSTS","Ceymed","Califolink","CCS","Starlink","CES","CTL","CSL","CMS","OCN","CSV","CAL","CMLS","DPL"];
const BANKS = ["HNB","Seylan Bank","Sampath Bank","Peoples Bank","Commercial Bank","NTB","DFCC","SCB","NDB","Cargills Bank","PABC","Central Finance"];
const LOAN_TYPES = ["Term Loan","Revolving Facility","Permanent Overdraft","Temporary Overdraft","Lease","Mortgage Loan","Invoice Factoring","Hybrid Loan"];
const DEPOSIT_TYPES = ["Fixed Deposit - LKR","Fixed Deposit - USD","Money Market Account","Cash Build Up Account","Unit Trust","Repo","Treasury Bill","Treasury Bond","Quoted Shares","Unquoted Shares"];
const CURRENCIES = ["LKR","USD","EUR"];
const REPAY_FREQ = ["Monthly","Quarterly","Bi-Annual","Annual","Bullet"];
const COMPANY_PALETTE = ["#185FA5","#0F6E56","#993C1D","#993556","#3B6D11","#534AB7","#BA7517","#A32D2D","#185FA5","#0F6E56","#993C1D","#993556","#3B6D11","#534AB7","#BA7517"];

const TODAY = new Date("2025-01-24");
const fmt = d => new Date(d).toISOString().split("T")[0];
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth()+n); return fmt(x); };

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const INIT_LOANS = [
  {id:"L001",company:"CHL",type:"Term Loan",bank:"HNB",currency:"LKR",facilityAmt:500000000,outstanding:380000000,interestType:"Variable",rate:10.75,spread:0.75,awplr:10.0,facilityDate:"2022-01-15",maturityDate:"2027-01-14",repayFreq:"Monthly",repayAmt:8333333,security:"Mortgage – Ratmalana land",purpose:"Working Capital",status:"Active",cashBacked:false},
  {id:"L002",company:"CHL",type:"Revolving Facility",bank:"Sampath Bank",currency:"LKR",facilityAmt:250000000,outstanding:180000000,interestType:"Variable",rate:11.0,spread:1.0,awplr:10.0,facilityDate:"2023-06-01",maturityDate:"2025-05-31",repayFreq:"Bullet",repayAmt:0,security:"Corporate Guarantee",purpose:"Working Capital",status:"Active",cashBacked:false},
  {id:"L003",company:"MSTS",type:"Term Loan",bank:"Commercial Bank",currency:"LKR",facilityAmt:200000000,outstanding:150000000,interestType:"Fixed",rate:12.5,spread:0,awplr:0,facilityDate:"2021-09-01",maturityDate:"2026-08-31",repayFreq:"Monthly",repayAmt:4166667,security:"FD Lien",purpose:"CAPEX",status:"Active",cashBacked:true},
  {id:"L004",company:"Ceymed",type:"Mortgage Loan",bank:"HNB",currency:"LKR",facilityAmt:300000000,outstanding:260000000,interestType:"Fixed",rate:11.5,spread:0,awplr:0,facilityDate:"2023-01-01",maturityDate:"2033-12-31",repayFreq:"Quarterly",repayAmt:7500000,security:"Mortgage – Borella",purpose:"CAPEX",status:"Active",cashBacked:false},
  {id:"L005",company:"CSL",type:"Permanent Overdraft",bank:"Seylan Bank",currency:"LKR",facilityAmt:100000000,outstanding:65000000,interestType:"Variable",rate:11.5,spread:1.5,awplr:10.0,facilityDate:"2024-01-01",maturityDate:"2025-12-31",repayFreq:"Bullet",repayAmt:0,security:"Corporate Guarantee",purpose:"Working Capital",status:"Active",cashBacked:false},
  {id:"L006",company:"CAL",type:"Term Loan",bank:"NTB",currency:"LKR",facilityAmt:150000000,outstanding:90000000,interestType:"Hybrid",rate:11.0,spread:0,awplr:0,facilityDate:"2020-07-01",maturityDate:"2027-06-30",repayFreq:"Monthly",repayAmt:3571429,security:"Mortgage – Kandy",purpose:"CAPEX",status:"Active",cashBacked:false},
  {id:"L007",company:"CES",type:"Term Loan",bank:"DFCC",currency:"LKR",facilityAmt:80000000,outstanding:48000000,interestType:"Fixed",rate:13.0,spread:0,awplr:0,facilityDate:"2021-03-01",maturityDate:"2026-02-28",repayFreq:"Monthly",repayAmt:2000000,security:"Equipment Mortgage",purpose:"CAPEX",status:"Active",cashBacked:false},
  {id:"L008",company:"CMLS",type:"Lease",bank:"Commercial Bank",currency:"LKR",facilityAmt:45000000,outstanding:32000000,interestType:"Fixed",rate:12.0,spread:0,awplr:0,facilityDate:"2022-10-01",maturityDate:"2027-09-30",repayFreq:"Monthly",repayAmt:1100000,security:"Asset Mortgage",purpose:"CAPEX",status:"Active",cashBacked:false},
  {id:"L009",company:"CSV",type:"Revolving Facility",bank:"Peoples Bank",currency:"LKR",facilityAmt:120000000,outstanding:95000000,interestType:"Variable",rate:11.25,spread:1.25,awplr:10.0,facilityDate:"2024-03-01",maturityDate:"2026-02-28",repayFreq:"Bullet",repayAmt:0,security:"Corporate Guarantee",purpose:"Working Capital",status:"Active",cashBacked:false},
  {id:"L010",company:"CMS",type:"Term Loan",bank:"NDB",currency:"LKR",facilityAmt:100000000,outstanding:72000000,interestType:"Variable",rate:10.5,spread:0.5,awplr:10.0,facilityDate:"2022-05-15",maturityDate:"2027-05-14",repayFreq:"Quarterly",repayAmt:5000000,security:"FD Lien",purpose:"Working Capital",status:"Active",cashBacked:true},
  {id:"L011",company:"CTL",type:"Temporary Overdraft",bank:"SCB",currency:"LKR",facilityAmt:50000000,outstanding:28000000,interestType:"Variable",rate:12.0,spread:2.0,awplr:10.0,facilityDate:"2024-06-01",maturityDate:"2025-08-31",repayFreq:"Bullet",repayAmt:0,security:"Corporate Guarantee",purpose:"Working Capital",status:"Active",cashBacked:false},
  {id:"L012",company:"OCN",type:"Invoice Factoring",bank:"HNB",currency:"LKR",facilityAmt:60000000,outstanding:42000000,interestType:"Fixed",rate:14.0,spread:0,awplr:0,facilityDate:"2024-01-15",maturityDate:"2025-01-14",repayFreq:"Bullet",repayAmt:0,security:"Invoice Assignment",purpose:"Working Capital",status:"Active",cashBacked:false},
];

const INIT_DEPOSITS = [
  {id:"D001",company:"CHL",bank:"HNB",branch:"Head Office",accountNo:"HNB-FD-2401",currency:"LKR",type:"Fixed Deposit - LKR",amount:50000000,rate:10.5,fromDate:"2024-10-01",toDate:"2025-04-01",pledged:true,facilityValue:45000000,leeway:5000000,purpose:"Lien for CSL OD"},
  {id:"D002",company:"CHL",bank:"Sampath Bank",branch:"Colombo 03",accountNo:"SB-FD-2402",currency:"LKR",type:"Fixed Deposit - LKR",amount:30000000,rate:10.0,fromDate:"2024-11-15",toDate:"2025-05-15",pledged:false,facilityValue:0,leeway:0,purpose:"Treasury Investment"},
  {id:"D003",company:"MSTS",bank:"Commercial Bank",branch:"Fort",accountNo:"CB-FD-2403",currency:"USD",type:"Fixed Deposit - USD",amount:100000,rate:5.5,fromDate:"2024-09-01",toDate:"2025-03-01",pledged:false,facilityValue:0,leeway:0,purpose:"USD Reserve"},
  {id:"D004",company:"Ceymed",bank:"HNB",branch:"Borella",accountNo:"HNB-FD-2404",currency:"LKR",type:"Fixed Deposit - LKR",amount:25000000,rate:10.25,fromDate:"2024-12-01",toDate:"2025-06-01",pledged:true,facilityValue:22000000,leeway:3000000,purpose:"Lien for OD"},
  {id:"D005",company:"CAL",bank:"NTB",branch:"Colombo 05",accountNo:"NTB-FD-2405",currency:"LKR",type:"Fixed Deposit - LKR",amount:40000000,rate:10.75,fromDate:"2025-01-15",toDate:"2025-07-15",pledged:false,facilityValue:0,leeway:0,purpose:"Investment"},
  {id:"D006",company:"CHL",bank:"Peoples Bank",branch:"Maradana",accountNo:"PB-MM-2406",currency:"LKR",type:"Money Market Account",amount:15000000,rate:9.5,fromDate:"2025-01-01",toDate:"2025-12-31",pledged:false,facilityValue:0,leeway:0,purpose:"Liquidity Buffer"},
  {id:"D007",company:"CMS",bank:"NDB",branch:"Maradana",accountNo:"NDB-FD-2407",currency:"LKR",type:"Fixed Deposit - LKR",amount:20000000,rate:10.0,fromDate:"2024-12-15",toDate:"2025-03-15",pledged:true,facilityValue:18000000,leeway:2000000,purpose:"Lien for Term Loan"},
  {id:"D008",company:"CSL",bank:"Seylan Bank",branch:"Galle Road",accountNo:"SB-FD-2408",currency:"LKR",type:"Fixed Deposit - LKR",amount:35000000,rate:10.5,fromDate:"2025-02-01",toDate:"2025-08-01",pledged:false,facilityValue:0,leeway:0,purpose:"Investment"},
];

const INIT_IC = [
  {id:"IC001",borrower:"OCN",through:"CHL",lender:"CSL",amount:5000000,rate:12.41,grantDate:"2024-11-07",repayDate:"2024-11-15",status:"Settled",settledDate:"2024-11-15",arRef:"1003633",dnRef:"AR-5091-DN",purpose:"Working Capital"},
  {id:"IC002",borrower:"OCN",through:"",lender:"CHL",amount:8000000,rate:12.41,grantDate:"2024-11-07",repayDate:"2025-02-28",status:"Active",settledDate:"",arRef:"",dnRef:"",purpose:"Bridge Finance"},
  {id:"IC003",borrower:"CMLS",through:"CHL",lender:"CES",amount:12000000,rate:10.81,grantDate:"2024-12-02",repayDate:"2025-03-31",status:"Active",settledDate:"",arRef:"1003628",dnRef:"AR-5075-DN",purpose:"CAPEX"},
  {id:"IC004",borrower:"CAL",through:"CHL",lender:"MSTS",amount:7500000,rate:10.72,grantDate:"2025-01-18",repayDate:"2025-02-04",status:"Active",settledDate:"",arRef:"",dnRef:"",purpose:"Working Capital"},
  {id:"IC005",borrower:"CSV",through:"CHL",lender:"CMLS",amount:9500000,rate:10.44,grantDate:"2024-12-20",repayDate:"2025-01-30",status:"Settled",settledDate:"2025-01-30",arRef:"1003640",dnRef:"AR-5095-DN",purpose:"Working Capital"},
];

const INIT_APPROVALS = [
  {id:"AR001",borrower:"Starlink",amount:25000000,purpose:"Working Capital",requestDate:"2025-01-20",status:"Pending GCFO",steps:[
    {role:"HOC – Starlink",status:"Approved",date:"2025-01-20",by:"K. Fernando"},
    {role:"HOF – Starlink",status:"Approved",date:"2025-01-21",by:"N. Silva"},
    {role:"Treasury",status:"Approved",date:"2025-01-22",by:"P. Perera",rate:"10.5%"},
    {role:"HOC – Lender",status:"Approved",date:"2025-01-23",by:"M. Jayawardena"},
    {role:"HOF – Lender",status:"Approved",date:"2025-01-23",by:"R. Gunawardena"},
    {role:"GCFO",status:"Pending",date:"",by:""},
  ]},
  {id:"AR002",borrower:"CES",amount:10000000,purpose:"Bridge Finance",requestDate:"2025-01-22",status:"Pending HOF",steps:[
    {role:"HOC – CES",status:"Approved",date:"2025-01-22",by:"S. Rajapaksa"},
    {role:"HOF – CES",status:"Pending",date:"",by:""},
    {role:"Treasury",status:"Pending",date:"",by:"",rate:""},
    {role:"HOC – Lender",status:"Pending",date:"",by:""},
    {role:"HOF – Lender",status:"Pending",date:"",by:""},
    {role:"GCFO",status:"Pending",date:"",by:""},
  ]},
];

const INIT_RATES = [
  {date:"2025-01-20",awplr:10.21,tb3m:9.85,tb6m:10.05,tb12m:10.35,tbond2y:11.20,tbond5y:12.10,tbond10y:12.75,usdlkr:298.50},
  {date:"2025-01-21",awplr:10.21,tb3m:9.82,tb6m:10.02,tb12m:10.32,tbond2y:11.18,tbond5y:12.08,tbond10y:12.72,usdlkr:298.75},
  {date:"2025-01-22",awplr:10.19,tb3m:9.80,tb6m:10.00,tb12m:10.30,tbond2y:11.15,tbond5y:12.05,tbond10y:12.70,usdlkr:299.10},
  {date:"2025-01-23",awplr:10.19,tb3m:9.78,tb6m:9.98,tb12m:10.28,tbond2y:11.12,tbond5y:12.02,tbond10y:12.68,usdlkr:299.25},
  {date:"2025-01-24",awplr:10.17,tb3m:9.75,tb6m:9.95,tb12m:10.25,tbond2y:11.10,tbond5y:12.00,tbond10y:12.65,usdlkr:299.50},
];

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const fmtM = n => `LKR ${(n/1e6).toFixed(1)}M`;
const fmtFull = n => "LKR " + Math.round(n).toLocaleString();
const fmtUSD = n => "USD " + n.toLocaleString();
const fmtPct = n => n.toFixed(2) + "%";

const daysLeft = toDate => Math.round((new Date(toDate) - TODAY) / 86400000);

const matBucket = toDate => {
  const d = daysLeft(toDate);
  if (d <= 7) return "0–7 days";
  if (d <= 30) return "8–30 days";
  if (d <= 90) return "31–90 days";
  if (d <= 180) return "91–180 days";
  if (d <= 365) return "181–365 days";
  return ">365 days";
};

const wtdRate = loans => {
  const tot = loans.reduce((s,l) => s+l.outstanding, 0);
  if (!tot) return 0;
  return loans.reduce((s,l) => s + l.outstanding * l.rate, 0) / tot;
};

const genAmort = (loan, months = 24) => {
  const rows = [];
  let bal = loan.outstanding;
  const mr = loan.rate / 100 / 12;
  for (let i = 1; i <= months && bal > 0; i++) {
    const interest = Math.round(bal * mr);
    let principal = 0;
    if (loan.repayFreq === "Monthly") principal = loan.repayAmt;
    else if (loan.repayFreq === "Quarterly" && i % 3 === 0) principal = loan.repayAmt;
    principal = Math.min(principal, bal);
    const opening = bal;
    bal = Math.round(bal - principal);
    rows.push({period:i, date:addMonths(TODAY, i), opening, principal, interest, total:principal+interest, closing:bal});
  }
  return rows;
};

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
const S = {
  card: {background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,padding:"16px 20px"},
  row: {display:"flex",alignItems:"center",gap:12},
  label: {fontSize:12,color:"var(--color-text-secondary)",marginBottom:4,display:"block",fontWeight:500},
  input: {width:"100%",boxSizing:"border-box"},
  btn: (c) => ({padding:"7px 16px",borderRadius:8,border:`0.5px solid ${c}`,background:c,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}),
  btnGhost: {padding:"7px 16px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",background:"transparent",color:"var(--color-text-primary)",cursor:"pointer",fontSize:13},
};

function KPI({label, value, sub, accent}) {
  return (
    <div style={{...S.card, borderTop:`3px solid ${accent}`}}>
      <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
      <div style={{fontSize:22,fontWeight:500,color:"var(--color-text-primary)"}}>{value}</div>
      {sub && <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:3}}>{sub}</div>}
    </div>
  );
}

function Badge({children, type="gray"}) {
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

function Table({cols, rows, onRow}) {
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

function Modal({title, onClose, children, wide}) {
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

function Field({label, type="text", value, onChange, options, half}) {
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

function FormRow({children}) {
  return <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{children}</div>;
}

function PageHeader({title, children}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{margin:0,fontSize:18,fontWeight:500,color:"var(--color-text-primary)"}}>{title}</h2>
      <div style={{display:"flex",gap:8}}>{children}</div>
    </div>
  );
}

function TabBar({tabs, active, onChange}) {
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

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({loans, deposits, icLoans, rates}) {
  const totalDebt = useMemo(() => loans.reduce((s,l) => s+l.outstanding,0), [loans]);
  const usdRate = rates.length ? rates[rates.length-1].usdlkr : 299;
  const totalDep = useMemo(() => deposits.reduce((s,d) => s+(d.currency==="USD"?d.amount*usdRate:d.amount),0),[deposits,usdRate]);
  const netDebt = totalDebt - totalDep;
  const avgRate = wtdRate(loans);
  const latest = rates.length ? rates[rates.length-1] : {};

  const debtByCo = useMemo(() => COMPANIES.map(c => ({name:c,value:loans.filter(l=>l.company===c).reduce((s,l)=>s+l.outstanding,0)})).filter(x=>x.value>0),[loans]);

  const ladder = useMemo(() => Array.from({length:12},(_,i) => {
    const d = new Date(TODAY); d.setMonth(d.getMonth()+i+1);
    const mo = d.toLocaleDateString("en-US",{month:"short",year:"2-digit"});
    const cap = loans.reduce((s,l) => {
      if (l.repayFreq==="Bullet") return s;
      if (l.repayFreq==="Monthly") return s+l.repayAmt;
      if (l.repayFreq==="Quarterly" && (i+1)%3===0) return s+l.repayAmt;
      return s;
    },0);
    const int = loans.reduce((s,l) => s+l.outstanding*(l.rate/100/12),0);
    return {mo, cap:Math.round(cap/1e6), int:Math.round(int/1e6)};
  }),[loans]);

  const activeIC = icLoans.filter(l=>l.status==="Active").length;

  return (
    <div>
      <PageHeader title="Treasury Dashboard" />
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:20}}>
        <KPI label="Total Debt" value={fmtM(totalDebt)} sub={`${loans.length} facilities`} accent="#185FA5" />
        <KPI label="Total Deposits" value={fmtM(totalDep)} sub="LKR equivalent" accent="#0F6E56" />
        <KPI label="Net Debt" value={fmtM(netDebt)} accent="#993C1D" />
        <KPI label="Wtd. Avg. Rate" value={fmtPct(avgRate)} sub="All borrowings" accent="#534AB7" />
        <KPI label="AWPLR" value={latest.awplr ? fmtPct(latest.awplr) : "—"} sub={latest.date} accent="#BA7517" />
        <KPI label="USD / LKR" value={latest.usdlkr || "—"} sub={latest.date} accent="#993556" />
        <KPI label="Active IC Loans" value={activeIC} sub="Intercompany" accent="#3B6D11" />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:16,marginBottom:16}}>
        <div style={S.card}>
          <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)"}}>Monthly repayment ladder — capital + interest (LKR Mn)</div>
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
        </div>
        <div style={S.card}>
          <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)"}}>Debt by company</div>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={debtByCo} cx="50%" cy="50%" innerRadius={48} outerRadius={88} dataKey="value" nameKey="name" label={e=>`${e.name} ${(e.percent*100).toFixed(0)}%`} labelLine={false} style={{fontSize:10}}>
                {debtByCo.map((_,i) => <Cell key={i} fill={COMPANY_PALETTE[i%15]} />)}
              </Pie>
              <Tooltip formatter={v => fmtM(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={S.card}>
        <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)"}}>Active facilities</div>
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
          rows={loans.slice(0,8)}
        />
      </div>
    </div>
  );
}

// ─── LOANS MODULE ─────────────────────────────────────────────────────────────
function LoansPage({loans, setLoans}) {
  const [modal, setModal] = useState(null); // null | "form" | loan obj for amort | "sens"
  const [filterCo, setFilterCo] = useState("");
  const [filterIT, setFilterIT] = useState("");
  const blank = {company:"",type:"",bank:"",currency:"LKR",facilityAmt:"",outstanding:"",interestType:"Fixed",rate:"",spread:"",awplr:"10.0",facilityDate:"",maturityDate:"",repayFreq:"Monthly",repayAmt:"",security:"",purpose:""};
  const [form, setForm] = useState(blank);

  const filtered = loans.filter(l => (!filterCo||l.company===filterCo) && (!filterIT||l.interestType===filterIT));
  const totalDebt = filtered.reduce((s,l)=>s+l.outstanding,0);
  const fixedDebt = filtered.filter(l=>l.interestType==="Fixed").reduce((s,l)=>s+l.outstanding,0);
  const varDebt = filtered.filter(l=>l.interestType!=="Fixed").reduce((s,l)=>s+l.outstanding,0);
  const avg = wtdRate(filtered);

  const sensData = [-2,-1,0,1,2].map(d => {
    const base = 10.0 + d;
    const ann = filtered.reduce((s,l) => {
      const r = l.interestType==="Fixed" ? l.rate : (l.spread + base);
      return s + l.outstanding * r / 100;
    },0);
    return {label:d===0?"Base (10%)":`${d>0?"+":""}${d}%`,annual:Math.round(ann/1e6),d};
  });

  const save = () => {
    const id = "L" + Date.now();
    setLoans([...loans, {...form, id, facilityAmt:+form.facilityAmt, outstanding:+form.outstanding, rate:+form.rate, spread:+form.spread||0, awplr:+form.awplr||0, repayAmt:+form.repayAmt||0, status:"Active", cashBacked:false}]);
    setModal(null); setForm(blank);
  };

  return (
    <div>
      <PageHeader title="Loans & Borrowings">
        <button style={S.btnGhost} onClick={() => setModal("sens")}>AWPLR sensitivity</button>
        <button style={S.btn("#185FA5")} onClick={() => { setModal("form"); setForm(blank); }}>+ Add facility</button>
      </PageHeader>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        <KPI label="Total outstanding" value={fmtM(totalDebt)} accent="#A32D2D" />
        <KPI label="Fixed rate debt" value={fmtM(fixedDebt)} sub={totalDebt?`${((fixedDebt/totalDebt)*100).toFixed(0)}% of total`:""} accent="#534AB7" />
        <KPI label="Variable rate debt" value={fmtM(varDebt)} sub={totalDebt?`${((varDebt/totalDebt)*100).toFixed(0)}% of total`:""} accent="#BA7517" />
        <KPI label="Wtd. avg. rate" value={fmtPct(avg)} accent="#0F6E56" />
      </div>

      <div style={{...S.card,marginBottom:16}}>
        <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <select value={filterCo} onChange={e=>setFilterCo(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",fontSize:13,background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}>
            <option value="">All companies</option>
            {COMPANIES.map(c=><option key={c}>{c}</option>)}
          </select>
          <select value={filterIT} onChange={e=>setFilterIT(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",fontSize:13,background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}>
            <option value="">All interest types</option>
            {["Fixed","Variable","Hybrid"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <Table
          cols={[
            {key:"id",label:"ID",nowrap:true},
            {key:"company",label:"Company"},
            {key:"type",label:"Type"},
            {key:"bank",label:"Bank"},
            {key:"outstanding",label:"Outstanding",render:v=>fmtM(v)},
            {key:"interestType",label:"Fixed/Var",render:v=><Badge type={v==="Fixed"?"blue":v==="Variable"?"amber":"gray"}>{v}</Badge>},
            {key:"rate",label:"Rate",render:(v,r)=>`${fmtPct(v)}${r.interestType==="Variable"?` (AWPLR+${r.spread}%)`:""}`},
            {key:"maturityDate",label:"Maturity"},
            {key:"security",label:"Security"},
            {key:"id",label:"",render:(_,r)=><button onClick={e=>{e.stopPropagation();setModal(r)}} style={{padding:"3px 10px",borderRadius:6,border:"0.5px solid var(--color-border-info)",background:"var(--color-background-info)",color:"var(--color-text-info)",cursor:"pointer",fontSize:12}}>Schedule</button>},
          ]}
          rows={filtered}
        />
      </div>

      {modal === "form" && (
        <Modal title="Add loan / facility" onClose={()=>setModal(null)} wide>
          <FormRow>
            <div style={{flex:1}}><Field label="Company" type="select" value={form.company} onChange={v=>setForm({...form,company:v})} options={COMPANIES} /></div>
            <div style={{flex:1}}><Field label="Loan type" type="select" value={form.type} onChange={v=>setForm({...form,type:v})} options={LOAN_TYPES} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Bank / institution" type="select" value={form.bank} onChange={v=>setForm({...form,bank:v})} options={BANKS} /></div>
            <div style={{flex:1}}><Field label="Currency" type="select" value={form.currency} onChange={v=>setForm({...form,currency:v})} options={CURRENCIES} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Facility amount (LKR)" type="number" value={form.facilityAmt} onChange={v=>setForm({...form,facilityAmt:v})} /></div>
            <div style={{flex:1}}><Field label="Outstanding balance" type="number" value={form.outstanding} onChange={v=>setForm({...form,outstanding:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Interest type" type="select" value={form.interestType} onChange={v=>setForm({...form,interestType:v})} options={["Fixed","Variable","Hybrid"]} /></div>
            <div style={{flex:1}}><Field label="Interest rate (%)" type="number" value={form.rate} onChange={v=>setForm({...form,rate:v})} /></div>
            {form.interestType!=="Fixed" && <div style={{flex:1}}><Field label="Spread over AWPLR (%)" type="number" value={form.spread} onChange={v=>setForm({...form,spread:v})} /></div>}
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Facility date" type="date" value={form.facilityDate} onChange={v=>setForm({...form,facilityDate:v})} /></div>
            <div style={{flex:1}}><Field label="Maturity date" type="date" value={form.maturityDate} onChange={v=>setForm({...form,maturityDate:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Repayment frequency" type="select" value={form.repayFreq} onChange={v=>setForm({...form,repayFreq:v})} options={REPAY_FREQ} /></div>
            <div style={{flex:1}}><Field label="Repayment amount" type="number" value={form.repayAmt} onChange={v=>setForm({...form,repayAmt:v})} /></div>
          </FormRow>
          <Field label="Security / collateral" value={form.security} onChange={v=>setForm({...form,security:v})} />
          <Field label="Purpose" value={form.purpose} onChange={v=>setForm({...form,purpose:v})} />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>setModal(null)}>Cancel</button>
            <button style={S.btn("#185FA5")} onClick={save}>Save facility</button>
          </div>
        </Modal>
      )}

      {modal && modal.id && modal.outstanding && (
        <Modal title={`Amortisation — ${modal.company} / ${modal.bank}`} onClose={()=>setModal(null)} wide>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
            {[["Outstanding",fmtFull(modal.outstanding)],["Rate",fmtPct(modal.rate)],["Freq",modal.repayFreq],["Matures",modal.maturityDate]].map(([k,v])=>(
              <div key={k} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{k}</div>
                <div style={{fontSize:14,fontWeight:500}}>{v}</div>
              </div>
            ))}
          </div>
          <Table
            cols={[
              {key:"period",label:"Period"},
              {key:"date",label:"Date"},
              {key:"opening",label:"Opening bal",render:v=>v.toLocaleString()},
              {key:"principal",label:"Principal",render:v=>v.toLocaleString()},
              {key:"interest",label:"Interest",render:v=>v.toLocaleString()},
              {key:"total",label:"Total payment",render:v=>v.toLocaleString()},
              {key:"closing",label:"Closing bal",render:v=>v.toLocaleString()},
            ]}
            rows={genAmort(modal, 24)}
          />
        </Modal>
      )}

      {modal === "sens" && (
        <Modal title="AWPLR sensitivity analysis" onClose={()=>setModal(null)}>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 16px"}}>Annual interest cost impact if AWPLR moves from the current base of 10.0%</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sensData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{fontSize:12}} />
              <YAxis />
              <Tooltip formatter={v=>`LKR ${v}M`} />
              <Bar dataKey="annual" name="Annual interest (LKR Mn)" radius={[6,6,0,0]}>
                {sensData.map((e,i)=><Cell key={i} fill={e.d===0?"#185FA5":e.d>0?"#A32D2D":"#0F6E56"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <Table
            cols={[
              {key:"label",label:"AWPLR scenario"},
              {key:"annual",label:"Annual interest (LKR Mn)",render:v=>`LKR ${v}M`},
              {key:"d",label:"Change vs base",render:(d,r)=>{const b=sensData[2].annual;const diff=r.annual-b;return <span style={{color:diff>0?"#A32D2D":diff<0?"#0F6E56":"var(--color-text-secondary)",fontWeight:500}}>{diff>0?"+":""}{diff}M</span>}},
            ]}
            rows={sensData}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── DEPOSITS MODULE ──────────────────────────────────────────────────────────
function DepositsPage({deposits, setDeposits}) {
  const [modal, setModal] = useState(false);
  const blank = {company:"",bank:"",branch:"",accountNo:"",currency:"LKR",type:"Fixed Deposit - LKR",amount:"",rate:"",fromDate:"",toDate:"",pledged:"false",facilityValue:"",purpose:""};
  const [form, setForm] = useState(blank);

  const lkrDep = deposits.filter(d=>d.currency==="LKR").reduce((s,d)=>s+d.amount,0);
  const usdDep = deposits.filter(d=>d.currency==="USD").reduce((s,d)=>s+d.amount,0);
  const pledged = deposits.filter(d=>d.pledged).reduce((s,d)=>s+(d.currency==="USD"?d.amount*299:d.amount),0);

  const BUCKETS = ["0–7 days","8–30 days","31–90 days","91–180 days","181–365 days",">365 days"];
  const matData = BUCKETS.map(b => ({
    b, amt: deposits.filter(d=>d.currency==="LKR"&&matBucket(d.toDate)===b).reduce((s,d)=>s+d.amount/1e6,0)
  }));

  const bankData = BANKS.map(bk => ({
    bk, amt: deposits.filter(d=>d.bank===bk).reduce((s,d)=>s+(d.currency==="USD"?d.amount*299:d.amount),0)
  })).filter(x=>x.amt>0);
  const maxBankAmt = Math.max(...bankData.map(x=>x.amt),1);

  const save = () => {
    setDeposits([...deposits, {...form, id:"D"+Date.now(), amount:+form.amount, rate:+form.rate, facilityValue:+form.facilityValue||0, leeway:+form.facilityValue?+form.amount-+form.facilityValue:0, pledged:form.pledged==="true"}]);
    setModal(false); setForm(blank);
  };

  return (
    <div>
      <PageHeader title="Deposits & Investments">
        <button style={S.btn("#0F6E56")} onClick={()=>{setModal(true);setForm(blank);}}>+ Add deposit</button>
      </PageHeader>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        <KPI label="Total LKR deposits" value={fmtM(lkrDep)} accent="#0F6E56" />
        <KPI label="Total USD deposits" value={fmtUSD(usdDep)} accent="#185FA5" />
        <KPI label="Pledged (lien)" value={fmtM(pledged)} accent="#BA7517" />
        <KPI label="Free deposits" value={fmtM(lkrDep-pledged)} sub="Unpledged LKR" accent="#534AB7" />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:16,marginBottom:16}}>
        <div style={S.card}>
          <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)"}}>Maturity profile — LKR deposits (Mn)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={matData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="b" tick={{fontSize:10}} />
              <YAxis />
              <Tooltip formatter={v=>`LKR ${v.toFixed(1)}M`} />
              <Bar dataKey="amt" name="Deposits" fill="#0F6E56" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)"}}>By bank</div>
          {bankData.map(b => (
            <div key={b.bk} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                <span style={{color:"var(--color-text-primary)"}}>{b.bk}</span>
                <span style={{fontWeight:500}}>{fmtM(b.amt)}</span>
              </div>
              <div style={{height:5,background:"var(--color-background-secondary)",borderRadius:3}}>
                <div style={{height:5,background:"#0F6E56",borderRadius:3,width:`${(b.amt/maxBankAmt)*100}%`}} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <Table
          cols={[
            {key:"id",label:"ID"},
            {key:"company",label:"Company"},
            {key:"bank",label:"Bank"},
            {key:"type",label:"Type"},
            {key:"currency",label:"Ccy"},
            {key:"amount",label:"Amount",render:(v,r)=>r.currency==="USD"?fmtUSD(v):fmtFull(v)},
            {key:"rate",label:"Rate",render:v=>fmtPct(v)},
            {key:"fromDate",label:"Start"},
            {key:"toDate",label:"Maturity"},
            {key:"pledged",label:"Pledged",render:v=><Badge type={v?"amber":"green"}>{v?"Yes":"No"}</Badge>},
            {key:"purpose",label:"Purpose"},
          ]}
          rows={deposits}
        />
      </div>

      {modal && (
        <Modal title="Add deposit / investment" onClose={()=>setModal(false)} wide>
          <FormRow>
            <div style={{flex:1}}><Field label="Company" type="select" value={form.company} onChange={v=>setForm({...form,company:v})} options={COMPANIES} /></div>
            <div style={{flex:1}}><Field label="Type" type="select" value={form.type} onChange={v=>setForm({...form,type:v})} options={DEPOSIT_TYPES} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Bank" type="select" value={form.bank} onChange={v=>setForm({...form,bank:v})} options={BANKS} /></div>
            <div style={{flex:1}}><Field label="Branch" value={form.branch} onChange={v=>setForm({...form,branch:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Account number" value={form.accountNo} onChange={v=>setForm({...form,accountNo:v})} /></div>
            <div style={{flex:1}}><Field label="Currency" type="select" value={form.currency} onChange={v=>setForm({...form,currency:v})} options={CURRENCIES} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Amount" type="number" value={form.amount} onChange={v=>setForm({...form,amount:v})} /></div>
            <div style={{flex:1}}><Field label="Interest rate (%)" type="number" value={form.rate} onChange={v=>setForm({...form,rate:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Start date" type="date" value={form.fromDate} onChange={v=>setForm({...form,fromDate:v})} /></div>
            <div style={{flex:1}}><Field label="Maturity date" type="date" value={form.toDate} onChange={v=>setForm({...form,toDate:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Pledged?" type="select" value={form.pledged} onChange={v=>setForm({...form,pledged:v})} options={["false","true"]} /></div>
            {form.pledged==="true" && <div style={{flex:1}}><Field label="Facility value (if pledged)" type="number" value={form.facilityValue} onChange={v=>setForm({...form,facilityValue:v})} /></div>}
          </FormRow>
          <Field label="Purpose" value={form.purpose} onChange={v=>setForm({...form,purpose:v})} />
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>setModal(false)}>Cancel</button>
            <button style={S.btn("#0F6E56")} onClick={save}>Save deposit</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── INTERCOMPANY MODULE ──────────────────────────────────────────────────────
function IntercompanyPage({icLoans, setIcLoans, approvals}) {
  const [tab, setTab] = useState("loans");
  const [modal, setModal] = useState(false);
  const blank = {borrower:"",through:"CHL",lender:"",amount:"",rate:"",grantDate:"",repayDate:"",purpose:""};
  const [form, setForm] = useState(blank);

  const active = icLoans.filter(l=>l.status==="Active");
  const settled = icLoans.filter(l=>l.status==="Settled");
  const totalActive = active.reduce((s,l)=>s+l.amount,0);

  const allCos = [...new Set([...icLoans.map(l=>l.borrower),...icLoans.map(l=>l.lender)])].filter(Boolean).sort();

  const save = () => {
    setIcLoans([...icLoans, {...form, id:"IC"+Date.now(), amount:+form.amount, rate:+form.rate, status:"Pending Approval", settledDate:"", arRef:"", dnRef:""}]);
    setModal(false); setForm(blank);
  };

  return (
    <div>
      <PageHeader title="Intercompany Funding">
        <button style={S.btn("#534AB7")} onClick={()=>{setModal(true);setForm(blank);}}>+ New funding request</button>
      </PageHeader>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        <KPI label="Active IC loans" value={active.length} sub={fmtM(totalActive)} accent="#534AB7" />
        <KPI label="Pending approvals" value={approvals.length} accent="#BA7517" />
        <KPI label="Settled this period" value={settled.length} accent="#0F6E56" />
      </div>

      <TabBar
        tabs={[{key:"loans",label:"IC Loans"},{key:"approvals",label:"Approval queue"},{key:"matrix",label:"Exposure matrix"}]}
        active={tab} onChange={setTab}
      />

      {tab === "loans" && (
        <div style={S.card}>
          <Table
            cols={[
              {key:"id",label:"ID"},
              {key:"borrower",label:"Borrower"},
              {key:"through",label:"Through"},
              {key:"lender",label:"Lender"},
              {key:"amount",label:"Amount",render:v=>v?fmtFull(v):"TBD"},
              {key:"rate",label:"Rate %",render:v=>v?fmtPct(v):"TBD"},
              {key:"grantDate",label:"Grant date"},
              {key:"repayDate",label:"Repay date"},
              {key:"status",label:"Status",render:v=><Badge type={v==="Active"?"green":v==="Settled"?"gray":v==="Pending Approval"?"amber":"blue"}>{v}</Badge>},
              {key:"dnRef",label:"DN Ref"},
            ]}
            rows={icLoans}
          />
        </div>
      )}

      {tab === "approvals" && (
        <div>
          {approvals.map(req => (
            <div key={req.id} style={{...S.card,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{fontWeight:500,fontSize:15,color:"var(--color-text-primary)"}}>{req.borrower} — {req.id}</div>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:3}}>
                    {fmtFull(req.amount)} &bull; {req.purpose} &bull; Requested {req.requestDate}
                  </div>
                </div>
                <Badge type="amber">{req.status}</Badge>
              </div>
              <div style={{display:"flex",gap:2,overflowX:"auto"}}>
                {req.steps.map((step, i) => (
                  <div key={i} style={{flex:"1 1 90px",textAlign:"center",padding:"0 4px"}}>
                    <div style={{
                      width:28,height:28,borderRadius:"50%",margin:"0 auto 6px",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:500,
                      background:step.status==="Approved"?"#0F6E56":step.status==="Pending"?"var(--color-background-secondary)":"#A32D2D",
                      color:step.status==="Approved"?"#fff":step.status==="Pending"?"var(--color-text-secondary)":"#fff"
                    }}>
                      {step.status==="Approved"?"✓":i+1}
                    </div>
                    <div style={{fontSize:10,color:step.status==="Approved"?"#0F6E56":"var(--color-text-secondary)",lineHeight:1.3}}>{step.role}</div>
                    {step.by && <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>{step.by}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "matrix" && (
        <div style={S.card}>
          <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)"}}>Active intercompany exposure — borrower vs lender (LKR)</div>
          <div style={{overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
              <thead>
                <tr>
                  <th style={{padding:"8px 12px",background:"#185FA5",color:"#fff",textAlign:"left",whiteSpace:"nowrap"}}>Borrower ↓ / Lender →</th>
                  {allCos.map(c=><th key={c} style={{padding:"8px 12px",background:"#185FA5",color:"#fff",textAlign:"center",minWidth:80}}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {allCos.map(borrower => (
                  <tr key={borrower}>
                    <td style={{padding:"8px 12px",fontWeight:500,background:"var(--color-background-secondary)",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>{borrower}</td>
                    {allCos.map(lender => {
                      const amt = active.filter(l=>l.borrower===borrower&&l.lender===lender).reduce((s,l)=>s+l.amount,0);
                      return <td key={lender} style={{padding:"8px 12px",textAlign:"center",background:amt>0?"var(--color-background-success)":"transparent",color:amt>0?"var(--color-text-success)":"var(--color-border-tertiary)",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
                        {amt>0?fmtFull(amt):"—"}
                      </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <Modal title="New intercompany funding request" onClose={()=>setModal(false)}>
          <div style={{background:"var(--color-background-warning)",border:"0.5px solid var(--color-border-warning)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"var(--color-text-warning)"}}>
            This request will initiate the 6-step approval workflow: HOC → HOF → Treasury → Lender HOC → Lender HOF → GCFO
          </div>
          <FormRow>
            <div style={{flex:1}}><Field label="Borrower company" type="select" value={form.borrower} onChange={v=>setForm({...form,borrower:v})} options={COMPANIES} /></div>
            <div style={{flex:1}}><Field label="Routed through" type="select" value={form.through} onChange={v=>setForm({...form,through:v})} options={["CHL",...COMPANIES]} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Lender company" type="select" value={form.lender} onChange={v=>setForm({...form,lender:v})} options={COMPANIES} /></div>
            <div style={{flex:1}}><Field label="Amount (LKR)" type="number" value={form.amount} onChange={v=>setForm({...form,amount:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Interest rate (%)" type="number" value={form.rate} onChange={v=>setForm({...form,rate:v})} /></div>
            <div style={{flex:1}}><Field label="Purpose" value={form.purpose} onChange={v=>setForm({...form,purpose:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Grant date" type="date" value={form.grantDate} onChange={v=>setForm({...form,grantDate:v})} /></div>
            <div style={{flex:1}}><Field label="Repayment date" type="date" value={form.repayDate} onChange={v=>setForm({...form,repayDate:v})} /></div>
          </FormRow>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>setModal(false)}>Cancel</button>
            <button style={S.btn("#534AB7")} onClick={save}>Submit for approval</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── RATE REGISTRY ────────────────────────────────────────────────────────────
function RatePage({rates, setRates}) {
  const [modal, setModal] = useState(false);
  const today = fmt(TODAY);
  const blank = {date:today,awplr:"",tb3m:"",tb6m:"",tb12m:"",tbond2y:"",tbond5y:"",tbond10y:"",usdlkr:""};
  const [form, setForm] = useState(blank);

  const save = () => {
    const n = Object.fromEntries(Object.entries(form).map(([k,v])=>[k,k==="date"?v:+v]));
    setRates([...rates.filter(r=>r.date!==n.date), n].sort((a,b)=>a.date.localeCompare(b.date)));
    setModal(false); setForm(blank);
  };

  const chartData = rates.slice(-20);

  return (
    <div>
      <PageHeader title="Interest rate registry">
        <button style={S.btn("#0F6E56")} onClick={()=>{setModal(true);setForm(blank);}}>+ Record today's rates</button>
      </PageHeader>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div style={S.card}>
          <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)"}}>AWPLR & treasury bill rates (%)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{fontSize:10}} />
              <YAxis domain={[9,13]} tick={{fontSize:10}} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="awplr" name="AWPLR" stroke="#185FA5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tb3m" name="TB 3M" stroke="#0F6E56" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tb12m" name="TB 12M" stroke="#BA7517" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tbond5y" name="TBond 5Y" stroke="#534AB7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)"}}>USD / LKR exchange rate</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{fontSize:10}} />
              <YAxis domain={[295,305]} tick={{fontSize:10}} />
              <Tooltip />
              <Area type="monotone" dataKey="usdlkr" name="USD/LKR" stroke="#993556" fill="#FBEAF0" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={S.card}>
        <Table
          cols={[
            {key:"date",label:"Date"},
            {key:"awplr",label:"AWPLR (%)"},
            {key:"tb3m",label:"TB 3M (%)"},
            {key:"tb6m",label:"TB 6M (%)"},
            {key:"tb12m",label:"TB 12M (%)"},
            {key:"tbond2y",label:"TBond 2Y (%)"},
            {key:"tbond5y",label:"TBond 5Y (%)"},
            {key:"tbond10y",label:"TBond 10Y (%)"},
            {key:"usdlkr",label:"USD/LKR"},
          ]}
          rows={[...rates].reverse()}
        />
      </div>

      {modal && (
        <Modal title="Record interest rates" onClose={()=>setModal(false)}>
          <Field label="Date" type="date" value={form.date} onChange={v=>setForm({...form,date:v})} />
          <FormRow>
            <div style={{flex:1}}><Field label="AWPLR (%)" type="number" value={form.awplr} onChange={v=>setForm({...form,awplr:v})} /></div>
            <div style={{flex:1}}><Field label="USD / LKR" type="number" value={form.usdlkr} onChange={v=>setForm({...form,usdlkr:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="TB 3-month (%)" type="number" value={form.tb3m} onChange={v=>setForm({...form,tb3m:v})} /></div>
            <div style={{flex:1}}><Field label="TB 6-month (%)" type="number" value={form.tb6m} onChange={v=>setForm({...form,tb6m:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="TB 12-month (%)" type="number" value={form.tb12m} onChange={v=>setForm({...form,tb12m:v})} /></div>
            <div style={{flex:1}}><Field label="T-Bond 2Y (%)" type="number" value={form.tbond2y} onChange={v=>setForm({...form,tbond2y:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="T-Bond 5Y (%)" type="number" value={form.tbond5y} onChange={v=>setForm({...form,tbond5y:v})} /></div>
            <div style={{flex:1}}><Field label="T-Bond 10Y (%)" type="number" value={form.tbond10y} onChange={v=>setForm({...form,tbond10y:v})} /></div>
          </FormRow>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>setModal(false)}>Cancel</button>
            <button style={S.btn("#0F6E56")} onClick={save}>Save rates</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── REPORTS MODULE ───────────────────────────────────────────────────────────
function ReportsPage({loans, deposits, rates}) {
  const [tab, setTab] = useState("borrowing");

  const usdRate = rates.length ? rates[rates.length-1].usdlkr : 299;

  const cashflow = useMemo(() => Array.from({length:6},(_,i) => {
    const d = new Date(TODAY); d.setMonth(d.getMonth()+i+1);
    const mo = d.toLocaleDateString("en-US",{month:"short",year:"2-digit"});
    const target = fmt(d);
    const outCap = loans.reduce((s,l) => {
      if (l.repayFreq==="Bullet") return s;
      if (l.repayFreq==="Monthly") return s+l.repayAmt;
      if (l.repayFreq==="Quarterly"&&(i+1)%3===0) return s+l.repayAmt;
      return s;
    },0);
    const outInt = loans.reduce((s,l)=>s+l.outstanding*(l.rate/100/12),0);
    const depIn = deposits.filter(d=>{
      const dd = new Date(d.toDate); dd.setDate(1);
      const sd = new Date(target); sd.setDate(1);
      return dd.toDateString()===sd.toDateString();
    }).reduce((s,d)=>s+(d.currency==="USD"?d.amount*usdRate:d.amount),0);
    return {mo, capOut:Math.round(outCap/1e6), intOut:Math.round(outInt/1e6), depIn:Math.round(depIn/1e6)};
  }),[loans, deposits, usdRate]);

  const compRatios = useMemo(() => COMPANIES.filter(c=>loans.some(l=>l.company===c)).map(c => {
    const cl = loans.filter(l=>l.company===c);
    const debt = cl.reduce((s,l)=>s+l.outstanding,0);
    const annInt = cl.reduce((s,l)=>s+l.outstanding*l.rate/100,0);
    const annRepay = cl.reduce((s,l)=>l.repayFreq==="Monthly"?s+l.repayAmt*12:l.repayFreq==="Quarterly"?s+l.repayAmt*4:s,0);
    return {company:c, debt, annInt, annRepay, avgRate:wtdRate(cl)};
  }),[loans]);

  const fxData = [0,5,10].map(pct=>{
    const nr = usdRate*(1+pct/100);
    const base = deposits.filter(d=>d.currency==="USD").reduce((s,d)=>s+d.amount*usdRate,0);
    const newV = deposits.filter(d=>d.currency==="USD").reduce((s,d)=>s+d.amount*nr,0);
    return {scenario:`+${pct}% LKR depreciation`,newRate:nr.toFixed(1),baseVal:Math.round(base/1e6),newVal:Math.round(newV/1e6),gain:Math.round((newV-base)/1e6)};
  });

  return (
    <div>
      <PageHeader title="Reports & analytics" />
      <TabBar
        tabs={[
          {key:"borrowing",label:"Borrowing schedule"},
          {key:"deposits",label:"Deposit schedule"},
          {key:"cashflow",label:"Cashflow forecast"},
          {key:"ratios",label:"Company ratios"},
          {key:"fx",label:"FX sensitivity"},
        ]}
        active={tab} onChange={setTab}
      />

      {tab === "borrowing" && (
        <div style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontWeight:500,fontSize:14,color:"var(--color-text-primary)"}}>Consolidated borrowing schedule</span>
            <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>Total outstanding: {fmtM(loans.reduce((s,l)=>s+l.outstanding,0))}</span>
          </div>
          <Table
            cols={[
              {key:"company",label:"Borrower"},
              {key:"type",label:"Type of debt"},
              {key:"bank",label:"Lender"},
              {key:"facilityDate",label:"Facility date"},
              {key:"maturityDate",label:"Maturity"},
              {key:"facilityAmt",label:"Facility amt",render:v=>fmtM(v)},
              {key:"outstanding",label:"Outstanding",render:v=>fmtM(v)},
              {key:"interestType",label:"Fixed/Var"},
              {key:"rate",label:"Rate",render:v=>fmtPct(v)},
              {key:"repayAmt",label:"Mo. repay",render:(v,r)=>r.repayFreq==="Monthly"?fmtM(v):"—"},
              {key:"security",label:"Security"},
            ]}
            rows={loans}
          />
        </div>
      )}

      {tab === "deposits" && (
        <div style={S.card}>
          <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)"}}>Consolidated deposit schedule</div>
          <Table
            cols={[
              {key:"company",label:"Company"},
              {key:"bank",label:"Bank"},
              {key:"branch",label:"Branch"},
              {key:"accountNo",label:"Account No."},
              {key:"currency",label:"Ccy"},
              {key:"type",label:"Type"},
              {key:"amount",label:"Amount",render:(v,r)=>r.currency==="USD"?fmtUSD(v):fmtFull(v)},
              {key:"rate",label:"Rate",render:v=>fmtPct(v)},
              {key:"fromDate",label:"Start"},
              {key:"toDate",label:"Maturity"},
              {key:"pledged",label:"Pledged",render:v=><Badge type={v?"amber":"green"}>{v?"Yes":"No"}</Badge>},
              {key:"facilityValue",label:"Facility val",render:(v,r)=>r.pledged?fmtFull(v):"—"},
            ]}
            rows={deposits}
          />
        </div>
      )}

      {tab === "cashflow" && (
        <div>
          <div style={{...S.card,marginBottom:16}}>
            <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)"}}>6-month cashflow forecast (LKR Mn)</div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mo" />
                <YAxis />
                <Tooltip formatter={v=>`LKR ${v}M`} />
                <Legend />
                <Bar dataKey="depIn" name="Deposit maturities (inflow)" fill="#0F6E56" stackId="in" />
                <Bar dataKey="capOut" name="Capital repayments (outflow)" fill="#A32D2D" stackId="out" />
                <Bar dataKey="intOut" name="Interest payments (outflow)" fill="#BA7517" stackId="out" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={S.card}>
            <Table
              cols={[
                {key:"mo",label:"Month"},
                {key:"depIn",label:"Deposit inflows (LKR Mn)",render:v=><span style={{color:"#0F6E56",fontWeight:500}}>+{v}M</span>},
                {key:"capOut",label:"Capital outflows (LKR Mn)",render:v=><span style={{color:"#A32D2D",fontWeight:500}}>-{v}M</span>},
                {key:"intOut",label:"Interest outflows (LKR Mn)",render:v=><span style={{color:"#BA7517",fontWeight:500}}>-{v}M</span>},
              ]}
              rows={cashflow}
            />
          </div>
        </div>
      )}

      {tab === "ratios" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16}}>
          {compRatios.map(r => (
            <div key={r.company} style={S.card}>
              <div style={{fontWeight:500,fontSize:14,marginBottom:12,color:"var(--color-text-primary)",borderBottom:"0.5px solid var(--color-border-tertiary)",paddingBottom:8}}>{r.company}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {l:"Total debt",v:fmtM(r.debt),t:"gray"},
                  {l:"Wtd. avg. rate",v:fmtPct(r.avgRate),t:"blue"},
                  {l:"Annual interest",v:fmtM(r.annInt),t:"amber"},
                  {l:"Annual capital repayment",v:fmtM(r.annRepay),t:"red"},
                ].map(({l,v,t}) => (
                  <div key={l} style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"8px 12px"}}>
                    <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:3}}>{l}</div>
                    <div style={{fontSize:15,fontWeight:500}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "fx" && (
        <div style={S.card}>
          <div style={{fontWeight:500,fontSize:14,marginBottom:6,color:"var(--color-text-primary)"}}>FX sensitivity — LKR depreciation impact on USD deposits</div>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 16px"}}>
            Current USD/LKR: {usdRate} &bull; USD deposits: {fmtUSD(deposits.filter(d=>d.currency==="USD").reduce((s,d)=>s+d.amount,0))}
          </p>
          <Table
            cols={[
              {key:"scenario",label:"Scenario"},
              {key:"newRate",label:"New USD/LKR rate"},
              {key:"baseVal",label:"Base value (LKR Mn)",render:v=>`LKR ${v}M`},
              {key:"newVal",label:"New value (LKR Mn)",render:v=>`LKR ${v}M`},
              {key:"gain",label:"FX gain / (loss)",render:v=><span style={{color:v>=0?"#0F6E56":"#A32D2D",fontWeight:500}}>{v>=0?"+":""}{v}M</span>},
            ]}
            rows={fxData}
          />
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const NAV = [
  {key:"dashboard",icon:"ti-dashboard",label:"Dashboard"},
  {key:"loans",icon:"ti-credit-card",label:"Loans & borrowings"},
  {key:"deposits",icon:"ti-building-bank",label:"Deposits"},
  {key:"intercompany",icon:"ti-arrows-exchange",label:"Intercompany"},
  {key:"rates",icon:"ti-chart-line",label:"Rate registry"},
  {key:"reports",icon:"ti-report-analytics",label:"Reports"},
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [loans, setLoans] = useState(INIT_LOANS);
  const [deposits, setDeposits] = useState(INIT_DEPOSITS);
  const [icLoans, setIcLoans] = useState(INIT_IC);
  const [approvals] = useState(INIT_APPROVALS);
  const [rates, setRates] = useState(INIT_RATES);

  const PAGES = {
    dashboard: <Dashboard loans={loans} deposits={deposits} icLoans={icLoans} rates={rates} />,
    loans: <LoansPage loans={loans} setLoans={setLoans} />,
    deposits: <DepositsPage deposits={deposits} setDeposits={setDeposits} />,
    intercompany: <IntercompanyPage icLoans={icLoans} setIcLoans={setIcLoans} approvals={approvals} />,
    rates: <RatePage rates={rates} setRates={setRates} />,
    reports: <ReportsPage loans={loans} deposits={deposits} rates={rates} />,
  };

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"var(--font-sans)",background:"var(--color-background-tertiary)"}}>
      {/* Sidebar */}
      <div style={{width:224,background:"#0A1628",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 18px 16px"}}>
          <div style={{color:"#5DCAA5",fontSize:10,fontWeight:500,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>CHL Group</div>
          <div style={{color:"#fff",fontSize:15,fontWeight:500}}>Treasury Module</div>
          <div style={{color:"#475569",fontSize:11,marginTop:2}}>Acumatica integration ready</div>
        </div>

        <nav style={{padding:"0 10px",flex:1,overflowY:"auto"}}>
          {NAV.map(item => {
            const active = page === item.key;
            return (
              <button key={item.key} onClick={()=>setPage(item.key)} style={{
                display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 10px",
                background:active?"rgba(29,158,117,0.15)":"transparent",
                color:active?"#5DCAA5":"#64748B",
                border:"none",borderRadius:8,cursor:"pointer",fontSize:13,
                fontWeight:active?500:400,textAlign:"left",marginBottom:2,
                borderLeft:active?"2px solid #5DCAA5":"2px solid transparent",
              }}>
                <i className={`ti ${item.icon}`} style={{fontSize:16}} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{padding:"14px 18px",borderTop:"0.5px solid rgba(255,255,255,0.06)"}}>
          <div style={{fontSize:10,color:"#334155",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Acumatica API</div>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#1D9E75"}} />
            <span style={{fontSize:12,color:"#475569"}}>Connected — ready to sync</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:"auto",padding:24}}>
        {PAGES[page]}
      </div>
    </div>
  );
}
