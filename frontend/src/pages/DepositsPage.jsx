import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { COMPANIES, BANKS, DEPOSIT_TYPES, CURRENCIES } from "../constants";
import { fmtM, fmtUSD, fmtFull, fmtPct, matBucket } from "../utils";
import { GlassCard, KpiGlass, Badge, Table, Modal, Field, FormRow, PageHeader, S } from "../components/UI";
import { depositsApi } from "../api/treasury";
import { USE_MOCK } from "../config";
import { usePermissions } from "../context/PermissionsContext";
import { useAuth } from "../context/AuthContext";

export default function DepositsPage({deposits, setDeposits}) {
  const [modal, setModal] = useState(false);
  const blank = {company:"",bank:"",branch:"",accountNo:"",currency:"LKR",type:"Fixed Deposit - LKR",amount:"",rate:"",fromDate:"",toDate:"",pledged:"false",facilityValue:"",purpose:""};
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
const { canDoAction } = usePermissions();
const canAdd = canDoAction(user, "add_deposit");

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

  const save = async () => {
    setSaving(true);
    try {
      const payload = {...form, amount:+form.amount, rate:+form.rate, facilityValue:+form.facilityValue||0};
      if (USE_MOCK) {
        const leeway = payload.facilityValue ? payload.amount - payload.facilityValue : 0;
        setDeposits([...deposits, {...payload, id:"D"+Date.now(), leeway, pledged: form.pledged==="true"}]);
      } else {
        const created = await depositsApi.create(payload);
        setDeposits([...deposits, created]);
      }
      setModal(false); setForm(blank);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Deposits & Investments">
  {canAdd && (
    <button style={S.btn("#0F6E56")} onClick={()=>{setModal(true);setForm(blank);}}>+ Add deposit</button>
  )}
</PageHeader>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        <KpiGlass label="Total LKR deposits" value={fmtM(lkrDep)} accent="#0F6E56" icon="ti-building-bank" />
        <KpiGlass label="Total USD deposits" value={fmtUSD(usdDep)} accent="#185FA5" icon="ti-currency-dollar" />
        <KpiGlass label="Pledged (lien)" value={fmtM(pledged)} accent="#BA7517" icon="ti-lock" />
        <KpiGlass label="Free deposits" value={fmtM(lkrDep-pledged)} sub="Unpledged LKR" accent="#534AB7" icon="ti-wallet" />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:16,marginBottom:16}}>
        <GlassCard title="Maturity profile — LKR deposits (Mn)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={matData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="b" tick={{fontSize:10}} />
              <YAxis />
              <Tooltip formatter={v=>`LKR ${v.toFixed(1)}M`} />
              <Bar dataKey="amt" name="Deposits" fill="#0F6E56" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
        <GlassCard title="By bank">
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
        </GlassCard>
      </div>

      <GlassCard>
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
      </GlassCard>

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
            <button style={S.btn("#0F6E56")} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save deposit"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}