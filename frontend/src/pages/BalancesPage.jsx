import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { COMPANIES, BANKS, CURRENCIES, ACCOUNT_TYPES } from "../constants";
import { fmtFull, fmtUSD, fmt, TODAY, latestBalances } from "../utils";
import { GlassCard, KpiGlass, Badge, Table, Modal, Field, FormRow, PageHeader, S } from "../components/UI";
import { balancesApi } from "../api/treasury";
import { USE_MOCK } from "../config";
import { usePermissions } from "../context/PermissionsContext";
import { useAuth } from "../context/AuthContext";

export default function BalancesPage({balances, setBalances}) {
  const [modal, setModal] = useState(false);
  const today = fmt(TODAY);
  const blank = {company:"",bank:"",branch:"",accountNo:"",accountType:"Current",currency:"LKR",balance:"",asOfDate:today};
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
const { canDoAction } = usePermissions();
const canAdd = canDoAction(user, "record_balance");

  const [fCompany, setFCompany] = useState("");
  const [fBank, setFBank] = useState("");
  const [fType, setFType] = useState("");

  const latestByAccount = useMemo(() => latestBalances(balances), [balances]);

  const filtered = useMemo(() => latestByAccount.filter(b =>
    (!fCompany || b.company===fCompany) &&
    (!fBank || b.bank===fBank) &&
    (!fType || b.accountType===fType)
  ), [latestByAccount, fCompany, fBank, fType]);

  const usdRate = 299.5;

  const totalLkr = filtered.filter(b=>b.currency==="LKR").reduce((s,b)=>s+b.balance,0);
  const totalUsd = filtered.filter(b=>b.currency==="USD").reduce((s,b)=>s+b.balance,0);
  const totalLkrEquiv = totalLkr + totalUsd*usdRate;
  const overdrafts = filtered.filter(b=>b.accountType==="Overdraft" || b.balance < 0);

  const byCompany = useMemo(() => COMPANIES.map(c => {
    const rows = filtered.filter(b=>b.company===c);
    return {
      company: c,
      Current: Math.round(rows.filter(b=>b.accountType==="Current").reduce((s,b)=>s+(b.currency==="USD"?b.balance*usdRate:b.balance),0)/1e6),
      Savings: Math.round(rows.filter(b=>b.accountType==="Savings").reduce((s,b)=>s+(b.currency==="USD"?b.balance*usdRate:b.balance),0)/1e6),
      Overdraft: Math.round(rows.filter(b=>b.accountType==="Overdraft").reduce((s,b)=>s+(b.currency==="USD"?b.balance*usdRate:b.balance),0)/1e6),
    };
  }).filter(x => x.Current || x.Savings || x.Overdraft), [filtered]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {...form, balance:+form.balance};
      if (USE_MOCK) {
        setBalances([...balances, {...payload, id:"B"+Date.now()}]);
      } else {
        const created = await balancesApi.save(payload);
        setBalances([...balances, created]);
      }
      setModal(false); setForm(blank);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = {padding:"6px 10px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",fontSize:13,background:"var(--color-background-primary)",color:"var(--color-text-primary)"};

  return (
    <div>
      <PageHeader title="Company Bank Balances">
  {canAdd && (
    <button style={S.btn("#185FA5")} onClick={()=>{setModal(true);setForm(blank);}}>+ Record today's balance</button>
  )}
</PageHeader>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        <KpiGlass label="Total LKR balance" value={fmtFull(totalLkr)} accent="#185FA5" icon="ti-building-bank" />
        <KpiGlass label="Total USD balance" value={fmtUSD(totalUsd)} accent="#0F6E56" icon="ti-currency-dollar" />
        <KpiGlass label="Group cash (LKR equiv.)" value={fmtFull(totalLkrEquiv)} sub="All currencies" accent="#534AB7" icon="ti-wallet" />
        <KpiGlass label="Overdrawn accounts" value={overdrafts.length} sub={overdrafts.length ? fmtFull(overdrafts.reduce((s,b)=>s+Math.abs(b.balance),0)) : ""} accent="#A32D2D" icon="ti-alert-triangle" />
      </div>

      <GlassCard style={{marginBottom:16, display:"flex", gap:10, flexWrap:"wrap"}}>
        <select value={fCompany} onChange={e=>setFCompany(e.target.value)} style={selectStyle}>
          <option value="">All companies</option>
          {COMPANIES.map(c=><option key={c}>{c}</option>)}
        </select>
        <select value={fBank} onChange={e=>setFBank(e.target.value)} style={selectStyle}>
          <option value="">All banks</option>
          {BANKS.map(b=><option key={b}>{b}</option>)}
        </select>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={selectStyle}>
          <option value="">All account types</option>
          {ACCOUNT_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
        {(fCompany||fBank||fType) && (
          <button style={S.btnGhost} onClick={()=>{setFCompany("");setFBank("");setFType("");}}>Clear filters</button>
        )}
      </GlassCard>

      <GlassCard title="Cash position by company — Current vs Savings vs Overdraft (LKR Mn)" style={{marginBottom:16}}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byCompany} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="company" tick={{fontSize:11}} />
            <YAxis tick={{fontSize:11}} />
            <Tooltip formatter={v=>`LKR ${v}M`} />
            <Legend />
            <Bar dataKey="Current" fill="#185FA5" radius={[4,4,0,0]} />
            <Bar dataKey="Savings" fill="#0F6E56" radius={[4,4,0,0]} />
            <Bar dataKey="Overdraft" fill="#A32D2D" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>

      <GlassCard title={`All accounts — as of ${filtered[0]?.asOfDate || today}`}>
        <Table
          cols={[
            {key:"company",label:"Company"},
            {key:"bank",label:"Bank"},
            {key:"branch",label:"Branch"},
            {key:"accountNo",label:"Account No."},
            {key:"accountType",label:"Type",render:v=><Badge type={v==="Overdraft"?"amber":"blue"}>{v}</Badge>},
            {key:"currency",label:"Ccy"},
            {key:"balance",label:"Balance",render:(v,r)=>{
              const display = r.currency==="USD" ? fmtUSD(v) : fmtFull(v);
              return <span style={{color: v<0 ? "#A32D2D" : "var(--color-text-primary)", fontWeight: v<0?600:400}}>{display}</span>;
            }},
            {key:"asOfDate",label:"As of"},
          ]}
          rows={[...filtered].sort((a,b)=>a.company.localeCompare(b.company))}
        />
      </GlassCard>

      {modal && (
        <Modal title="Record today's balance" onClose={()=>setModal(false)} wide>
          <FormRow>
            <div style={{flex:1}}><Field label="Company" type="select" value={form.company} onChange={v=>setForm({...form,company:v})} options={COMPANIES} /></div>
            <div style={{flex:1}}><Field label="Bank" type="select" value={form.bank} onChange={v=>setForm({...form,bank:v})} options={BANKS} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Branch" value={form.branch} onChange={v=>setForm({...form,branch:v})} /></div>
            <div style={{flex:1}}><Field label="Account number" value={form.accountNo} onChange={v=>setForm({...form,accountNo:v})} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Account type" type="select" value={form.accountType} onChange={v=>setForm({...form,accountType:v})} options={ACCOUNT_TYPES} /></div>
            <div style={{flex:1}}><Field label="Currency" type="select" value={form.currency} onChange={v=>setForm({...form,currency:v})} options={CURRENCIES} /></div>
          </FormRow>
          <FormRow>
            <div style={{flex:1}}><Field label="Balance (negative if overdrawn)" type="number" value={form.balance} onChange={v=>setForm({...form,balance:v})} /></div>
            <div style={{flex:1}}><Field label="As of date" type="date" value={form.asOfDate} onChange={v=>setForm({...form,asOfDate:v})} /></div>
          </FormRow>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>setModal(false)}>Cancel</button>
            <button style={S.btn("#185FA5")} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save balance"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}