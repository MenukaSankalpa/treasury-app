import { useState } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fmt, TODAY } from "../utils";
import { GlassCard, Table, Modal, Field, FormRow, PageHeader, S } from "../components/UI";
import { ratesApi } from "../api/treasury";
import { USE_MOCK } from "../config";

export default function RatePage({rates, setRates}) {
  const [modal, setModal] = useState(false);
  const today = fmt(TODAY);
  const blank = {date:today,awplr:"",tb3m:"",tb6m:"",tb12m:"",tbond2y:"",tbond5y:"",tbond10y:"",usdlkr:""};
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const n = Object.fromEntries(Object.entries(form).map(([k,v])=>[k,k==="date"?v:+v]));
      if (!USE_MOCK) await ratesApi.save(n);
      setRates([...rates.filter(r=>r.date!==n.date), n].sort((a,b)=>a.date.localeCompare(b.date)));
      setModal(false); setForm(blank);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const chartData = rates.slice(-20);

  return (
    <div>
      <PageHeader title="Interest rate registry">
        <button style={S.btn("#0F6E56")} onClick={()=>{setModal(true);setForm(blank);}}>+ Record today's rates</button>
      </PageHeader>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <GlassCard title="AWPLR & treasury bill rates (%)">
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
        </GlassCard>
        <GlassCard title="USD / LKR exchange rate">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{fontSize:10}} />
              <YAxis domain={[295,305]} tick={{fontSize:10}} />
              <Tooltip />
              <Area type="monotone" dataKey="usdlkr" name="USD/LKR" stroke="#993556" fill="#FBEAF0" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <GlassCard>
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
      </GlassCard>

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
            <button style={S.btn("#0F6E56")} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save rates"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}