import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { COMPANIES } from "../constants";
import { fmtM, fmtFull, fmtPct, wtdRate, TODAY } from "../utils";
import { GlassCard, KpiGlass, Badge, Table, Modal, PageHeader, Field, S } from "../components/UI";
import { useAuth } from "../context/AuthContext";

const COMPANY_SCOPED_ROLES = ["TeamMember", "Accountant", "CompanyHead"];

const PRESETS = [
  {key:"all", label:"All time"},
  {key:"30d", label:"30D"},
  {key:"90d", label:"90D"},
  {key:"ytd", label:"YTD"},
  {key:"custom", label:"Custom"},
];

const EXPORT_SECTIONS = [
  {key:"summary", label:"Summary KPIs", always:true},
  {key:"loans", label:"Loans & Borrowings"},
  {key:"deposits", label:"Deposits"},
  {key:"intercompany", label:"Intercompany Loans"},
  {key:"balances", label:"Bank Balances"},
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

function downloadWorkbook(sheets, filename) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({name, rows}) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31));
  });
  XLSX.writeFile(wb, filename);
}

export default function ReportsPage({loans=[], deposits=[], rates=[], icLoans=[], balances=[]}) {
  const { user } = useAuth();
  const isCompanyScoped = COMPANY_SCOPED_ROLES.includes(user.role);

  const [preset, setPreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [company, setCompany] = useState(isCompanyScoped ? user.company : "");
  const [section, setSection] = useState("loans");
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState(
    EXPORT_SECTIONS.reduce((acc,s) => ({...acc, [s.key]: true}), {})
  );

  const {from, to} = preset === "custom" ? {from:customFrom, to:customTo} : presetToRange(preset);
  const isDateFiltered = !!(from || to);
  const isFiltered = isDateFiltered || (!isCompanyScoped && !!company);

  const effectiveCompany = isCompanyScoped ? user.company : company;

  const loansF = useMemo(() => loans.filter(l =>
    (!effectiveCompany || l.company === effectiveCompany) &&
    (!isDateFiltered || inRange(l.facilityDate, from, to))
  ), [loans, effectiveCompany, from, to, isDateFiltered]);

  const depositsF = useMemo(() => deposits.filter(d =>
    (!effectiveCompany || d.company === effectiveCompany) &&
    (!isDateFiltered || inRange(d.fromDate, from, to))
  ), [deposits, effectiveCompany, from, to, isDateFiltered]);

  const icLoansF = useMemo(() => icLoans.filter(l =>
    (!effectiveCompany || l.borrowerCompany === effectiveCompany || l.treasuryDecision?.lenders?.some(x=>x.company===effectiveCompany)) &&
    (!isDateFiltered || inRange(l.requestedDate, from, to))
  ), [icLoans, effectiveCompany, from, to, isDateFiltered]);

  const balancesF = useMemo(() => balances.filter(b =>
    (!effectiveCompany || b.company === effectiveCompany) &&
    (!isDateFiltered || inRange(b.asOfDate, from, to))
  ), [balances, effectiveCompany, from, to, isDateFiltered]);

  const activeLoans = loansF.filter(l => (l.status || "Active") === "Active");
  const totalDebt = activeLoans.reduce((s,l)=>s+l.outstanding,0);
  const usdRate = rates.length ? rates[rates.length-1].usdlkr : 299;
  const totalDep = depositsF.reduce((s,d)=>s+(d.currency==="USD"?d.amount*usdRate:d.amount),0);
  const avgRate = wtdRate(activeLoans);
  const activeIC = icLoansF.filter(l=>l.status==="Active").length;
  const icOutstanding = icLoansF.filter(l=>l.status==="Active").reduce((s,l)=>s+l.amount,0);

  const pillBase = { padding:"6px 14px", borderRadius:20, border:"none", fontSize:12.5, fontWeight:500, cursor:"pointer" };
  const selectStyle = {padding:"7px 14px",borderRadius:20,border:"1px solid var(--color-border-secondary)",fontSize:12.5,fontWeight:500,cursor:"pointer",background:"var(--color-background-primary)",color:"var(--color-text-primary)"};
  const statusBadge = (s) => s==="Active"?"green":s==="Rejected"?"red":s==="Settled"?"gray":"amber";

  const toggleSection = (key) => setSelectedSections(prev => ({...prev, [key]: !prev[key]}));
  const toggleAllSections = () => {
    const allOn = EXPORT_SECTIONS.filter(s=>!s.always).every(s => selectedSections[s.key]);
    const next = {...selectedSections};
    EXPORT_SECTIONS.forEach(s => { if (!s.always) next[s.key] = !allOn; });
    setSelectedSections(next);
  };

  const runExport = () => {
    const scopeLabel = effectiveCompany || "All Companies";
    const rangeLabel = isDateFiltered ? `${from||"…"} to ${to||"…"}` : "All time";
    const sheets = [];

    if (selectedSections.summary) {
      sheets.push({
        name:"Summary",
        rows:[
          { Metric:"Report scope (company)", Value: scopeLabel },
          { Metric:"Date range", Value: rangeLabel },
          { Metric:"Generated by", Value: `${user.name} (${user.role})` },
          { Metric:"Generated on", Value: TODAY.toISOString().split("T")[0] },
          { Metric:"", Value:"" },
          { Metric:"Total Debt (Active)", Value: totalDebt },
          { Metric:"Total Deposits", Value: totalDep },
          { Metric:"Wtd. Avg. Rate %", Value: avgRate.toFixed(2) },
          { Metric:"Active Intercompany Loans", Value: activeIC },
          { Metric:"Intercompany Outstanding", Value: icOutstanding },
        ],
      });
    }

    if (selectedSections.loans) {
      sheets.push({
        name:"Loans",
        rows: loansF.length ? loansF.map(l => ({
          ID:l.id, Company:l.company, Type:l.type, Bank:l.bank, "Bank Account":l.bankAccountNo||"",
          "Facility Amount":l.facilityAmt, Outstanding:l.outstanding, "Interest Type":l.interestType,
          "Rate %":l.rate, Status:l.status||"Active", "Facility Date":l.facilityDate, "Maturity Date":l.maturityDate,
          "Repay Freq":l.repayFreq, Security:l.security, Purpose:l.purpose,
        })) : [{Note:"No records in this range"}],
      });
    }

    if (selectedSections.deposits) {
      sheets.push({
        name:"Deposits",
        rows: depositsF.length ? depositsF.map(d => ({
          ID:d.id, Company:d.company, Bank:d.bank, Branch:d.branch, "Account No":d.accountNo,
          Currency:d.currency, Type:d.type, Amount:d.amount, "Rate %":d.rate,
          "From Date":d.fromDate, "To Date":d.toDate, Pledged:d.pledged?"Yes":"No", Purpose:d.purpose,
        })) : [{Note:"No records in this range"}],
      });
    }

    if (selectedSections.intercompany) {
      sheets.push({
        name:"Intercompany",
        rows: icLoansF.length ? icLoansF.map(l => ({
          Ref:l.requestNo, Borrower:l.borrowerCompany, "Loan Type":l.loanType, Bank:l.bankName,
          Amount:l.amount, Status:l.status, "Requested Date":l.requestedDate,
          "Repayment Date":l.treasuryDecision?.finalRepaymentDate || l.requestedRepaymentDate,
          "Interest Rate %":l.treasuryDecision?.interestRate || "",
          Lenders: l.treasuryDecision?.lenders?.map(x=>`${x.company} (${x.amount})`).join("; ") || "",
          Purpose:l.borrowerPurpose,
        })) : [{Note:"No records in this range"}],
      });
    }

    if (selectedSections.balances) {
      sheets.push({
        name:"Balances",
        rows: balancesF.length ? balancesF.map(b => ({
          ID:b.id, Company:b.company, Bank:b.bank, Branch:b.branch, "Account No":b.accountNo,
          "Account Type":b.accountType, Currency:b.currency, Balance:b.balance, "As Of":b.asOfDate,
        })) : [{Note:"No records in this range"}],
      });
    }

    downloadWorkbook(sheets, `Treasury_Report_${scopeLabel.replace(/\s+/g,"_")}_${TODAY.toISOString().split("T")[0]}.xlsx`);
    setExportOpen(false);
  };

  return (
    <div>
      <PageHeader title={isCompanyScoped ? `Reports — ${user.company}` : "Reports — All Companies"}>
        <button style={S.btn("#0F6E56")} onClick={()=>setExportOpen(true)}>⬇ Export to Excel</button>
      </PageHeader>

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

          {!isCompanyScoped && (
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Company</span>
              <select value={company} onChange={e=>setCompany(e.target.value)} style={{...selectStyle, background: company ? "#185FA5" : "var(--color-background-primary)", color: company ? "#fff" : "var(--color-text-primary)"}}>
                <option value="">All companies</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {isFiltered && (
            <button onClick={() => { setPreset("all"); setCustomFrom(""); setCustomTo(""); if (!isCompanyScoped) setCompany(""); }} style={{...pillBase, background:"transparent", border:"1px solid var(--color-border-secondary)", color:"var(--color-text-secondary)"}}>
              ✕ Clear
            </button>
          )}
        </div>
      </GlassCard>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:16}}>
        <KpiGlass label="Total Debt" value={fmtM(totalDebt)} sub={`${activeLoans.length} active facilities`} accent="#185FA5" icon="ti-credit-card" />
        <KpiGlass label="Total Deposits" value={fmtM(totalDep)} sub="LKR equivalent" accent="#0F6E56" icon="ti-building-bank" />
        <KpiGlass label="Wtd. Avg. Rate" value={fmtPct(avgRate)} accent="#534AB7" icon="ti-percentage" />
        <KpiGlass label="Active IC Loans" value={activeIC} sub={fmtFull(icOutstanding)} accent="#3B6D11" icon="ti-arrows-exchange" />
      </div>

      <div style={{display:"flex", gap:4, marginBottom:16, background:"rgba(0,0,0,0.04)", borderRadius:10, padding:3, width:"fit-content"}}>
        {[
          {key:"loans", label:"Loans"},
          {key:"deposits", label:"Deposits"},
          {key:"intercompany", label:"Intercompany"},
          {key:"balances", label:"Balances"},
        ].map(s => (
          <button key={s.key} onClick={()=>setSection(s.key)} style={{padding:"7px 16px",borderRadius:8,border:"none",fontSize:13,fontWeight:500,cursor:"pointer",background: section===s.key ? "#fff" : "transparent", color: section===s.key ? "var(--color-text-primary)" : "var(--color-text-secondary)", boxShadow: section===s.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none"}}>
            {s.label}
          </button>
        ))}
      </div>

      {section === "loans" && (
        <GlassCard title={`Loans & Borrowings (${loansF.length})`}>
          <Table
            cols={[
              {key:"company",label:"Company"},
              {key:"type",label:"Type"},
              {key:"bank",label:"Bank"},
              {key:"outstanding",label:"Outstanding",render:v=>fmtM(v)},
              {key:"rate",label:"Rate",render:v=>fmtPct(v)},
              {key:"status",label:"Status",render:v=><Badge type={statusBadge(v||"Active")}>{v||"Active"}</Badge>},
              {key:"maturityDate",label:"Maturity"},
            ]}
            rows={loansF}
          />
        </GlassCard>
      )}

      {section === "deposits" && (
        <GlassCard title={`Deposits (${depositsF.length})`}>
          <Table
            cols={[
              {key:"company",label:"Company"},
              {key:"bank",label:"Bank"},
              {key:"type",label:"Type"},
              {key:"amount",label:"Amount",render:v=>fmtFull(v)},
              {key:"rate",label:"Rate",render:v=>fmtPct(v)},
              {key:"fromDate",label:"From"},
              {key:"toDate",label:"To"},
              {key:"pledged",label:"Pledged",render:v=><Badge type={v?"amber":"gray"}>{v?"Yes":"No"}</Badge>},
            ]}
            rows={depositsF}
          />
        </GlassCard>
      )}

      {section === "intercompany" && (
        <GlassCard title={`Intercompany Loans (${icLoansF.length})`}>
          <Table
            cols={[
              {key:"requestNo",label:"Ref"},
              {key:"borrowerCompany",label:"Borrower"},
              {key:"loanType",label:"Type"},
              {key:"amount",label:"Amount",render:v=>fmtFull(v)},
              {key:"status",label:"Status",render:v=><Badge type={statusBadge(v)}>{v}</Badge>},
              {key:"requestedRepaymentDate",label:"Repay By",render:(v,r)=>r.treasuryDecision?.finalRepaymentDate||v},
            ]}
            rows={icLoansF}
          />
        </GlassCard>
      )}

      {section === "balances" && (
        <GlassCard title={`Bank Balances (${balancesF.length})`}>
          <Table
            cols={[
              {key:"company",label:"Company"},
              {key:"bank",label:"Bank"},
              {key:"accountType",label:"Type"},
              {key:"balance",label:"Balance",render:v=>fmtFull(v)},
              {key:"asOfDate",label:"As Of"},
            ]}
            rows={balancesF}
          />
        </GlassCard>
      )}

      {exportOpen && (
        <Modal title="Export report to Excel" onClose={()=>setExportOpen(false)}>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:6}}>
            Scope: <strong>{effectiveCompany || "All Companies"}</strong> · Period: <strong>{isDateFiltered ? `${from||"…"} to ${to||"…"}` : "All time"}</strong>
          </p>
          <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:16}}>
            Choose which sections to include — each becomes its own sheet in the downloaded file.
          </p>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600}}>Sections to include</div>
            <button onClick={toggleAllSections} style={{background:"none",border:"none",color:"var(--color-text-info)",fontSize:12,cursor:"pointer",padding:0}}>
              Select / deselect all
            </button>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {EXPORT_SECTIONS.map(s => (
              <label key={s.key} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",border:`1px solid ${selectedSections[s.key]?"#0F6E56":"var(--color-border-secondary)"}`,borderRadius:8,cursor: s.always ? "default" : "pointer",background: selectedSections[s.key] ? "var(--color-background-info)" : "var(--color-background-primary)"}}>
                <input
                  type="checkbox"
                  checked={selectedSections[s.key]}
                  disabled={s.always}
                  onChange={()=>toggleSection(s.key)}
                  style={{width:16,height:16}}
                />
                <span style={{fontSize:13,color:"var(--color-text-primary)"}}>{s.label}</span>
                {s.always && <span style={{fontSize:11,color:"var(--color-text-secondary)",marginLeft:"auto"}}>Always included</span>}
                {!s.always && (
                  <span style={{fontSize:11,color:"var(--color-text-secondary)",marginLeft:"auto"}}>
                    {s.key==="loans" && `${loansF.length} rows`}
                    {s.key==="deposits" && `${depositsF.length} rows`}
                    {s.key==="intercompany" && `${icLoansF.length} rows`}
                    {s.key==="balances" && `${balancesF.length} rows`}
                  </span>
                )}
              </label>
            ))}
          </div>

          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button style={S.btnGhost} onClick={()=>setExportOpen(false)}>Cancel</button>
            <button
              style={S.btn("#0F6E56")}
              onClick={runExport}
              disabled={!EXPORT_SECTIONS.some(s => selectedSections[s.key])}
            >
              Export selected
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}