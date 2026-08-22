import { useState } from "react";
import { COMPANIES } from "../constants";
import { fmtFull, fmtPct } from "../utils";
import { S, KPI, Badge, Table, Modal, Field, FormRow, PageHeader, TabBar } from "../components/UI";
import { intercompanyApi } from "../api/treasury";

export default function IntercompanyPage({icLoans, setIcLoans, approvals}) {
  const [tab, setTab] = useState("loans");
  const [modal, setModal] = useState(false);
  const blank = {borrower:"",through:"CHL",lender:"",amount:"",rate:"",grantDate:"",repayDate:"",purpose:""};
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const active = icLoans.filter(l=>l.status==="Active");
  const settled = icLoans.filter(l=>l.status==="Settled");
  const totalActive = active.reduce((s,l)=>s+l.amount,0);

  const allCos = [...new Set([...icLoans.map(l=>l.borrower),...icLoans.map(l=>l.lender)])].filter(Boolean).sort();

  const save = async () => {
    setSaving(true);
    try {
      const payload = {...form, amount:+form.amount, rate:+form.rate};
      const created = await intercompanyApi.createLoan(payload); // persists to MySQL, kicks off approval workflow
      setIcLoans([...icLoans, created]);
      setModal(false); setForm(blank);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Intercompany Funding">
        <button style={S.btn("#534AB7")} onClick={()=>{setModal(true);setForm(blank);}}>+ New funding request</button>
      </PageHeader>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        <KPI label="Active IC loans" value={active.length} sub={fmtFull(totalActive)} accent="#534AB7" />
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
            <button style={S.btn("#534AB7")} onClick={save} disabled={saving}>{saving ? "Submitting…" : "Submit for approval"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}