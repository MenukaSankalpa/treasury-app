import { useState } from "react";
import { COMPANIES } from "../constants";
import { fmtFull, fmtPct } from "../utils";
import { S, KPI, Badge, Table, Modal, Field, FormRow, PageHeader, TabBar } from "../components/UI";
import { intercompanyApi } from "../api/treasury";
import { useAuth } from "../context/AuthContext";

export default function IntercompanyPage({icLoans, setIcLoans, approvals, setApprovals}) {
  const { user, isSuperAdmin } = useAuth();
  const [tab, setTab] = useState("loans");
  const [modal, setModal] = useState(false);
  const blank = {borrower:"",through:"CHL",lender:"",amount:"",rate:"",grantDate:"",repayDate:"",purpose:""};
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [actingStep, setActingStep] = useState(null); // `${requestId}-${stepOrder}` while submitting
  const [comments, setComments] = useState({}); // keyed by `${requestId}-${stepOrder}`

  const active = icLoans.filter(l=>l.status==="Active");
  const settled = icLoans.filter(l=>l.status==="Settled");
  const totalActive = active.reduce((s,l)=>s+l.amount,0);

  const allCos = [...new Set([...icLoans.map(l=>l.borrower),...icLoans.map(l=>l.lender)])].filter(Boolean).sort();

  const save = async () => {
    setSaving(true);
    try {
      const payload = {...form, amount:+form.amount, rate:+form.rate};
      const created = await intercompanyApi.createLoan(payload); // creates loan + 6-step workflow assigned to real users
      setIcLoans([...icLoans, created]);
      setModal(false); setForm(blank);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // A step can be acted on if it belongs to the current user (or SuperAdmin),
  // it's still Pending, and every step before it is already Approved.
  const canAct = (req, step) => {
    if (step.status !== "Pending") return false;
    const priorSteps = req.steps.filter(s => s.step_order < step.step_order);
    if (priorSteps.some(s => s.status !== "Approved")) return false;
    if (isSuperAdmin) return true;
    return step.assigned_user_id === user.id;
  };

  const actOnStep = async (req, step, action) => {
    const key = `${req.id}-${step.step_order}`;
    setActingStep(key);
    try {
      await intercompanyApi.actOnStep(req.id, step.step_order, action, comments[key] || "");
      const refreshed = await intercompanyApi.listApprovals();
      setApprovals(refreshed);
      if (action === "reject") {
        const refreshedLoans = await intercompanyApi.listLoans();
        setIcLoans(refreshedLoans);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActingStep(null);
    }
  };

  return (
    <div>
      <PageHeader title="Intercompany Funding">
        <button style={S.btn("#534AB7")} onClick={()=>{setModal(true);setForm(blank);}}>+ New funding request</button>
      </PageHeader>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        <KPI label="Active IC loans" value={active.length} sub={fmtFull(totalActive)} accent="#534AB7" />
        <KPI label="Pending approvals" value={approvals.filter(a=>a.status?.startsWith("Pending")).length} accent="#BA7517" />
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
              {key:"status",label:"Status",render:v=><Badge type={v==="Active"?"green":v==="Settled"?"gray":v==="Rejected"?"red":v==="Pending Approval"?"amber":"blue"}>{v}</Badge>},
              {key:"dnRef",label:"DN Ref"},
            ]}
            rows={icLoans}
          />
        </div>
      )}

      {tab === "approvals" && (
        <div>
          {approvals.length === 0 && (
            <div style={{...S.card, textAlign:"center", color:"var(--color-text-secondary)", padding:32}}>No approval requests yet</div>
          )}
          {approvals.map(req => (
            <div key={req.id} style={{...S.card,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{fontWeight:500,fontSize:15,color:"var(--color-text-primary)"}}>{req.borrower} — {req.id}</div>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:3}}>
                    {fmtFull(req.amount)} &bull; {req.purpose} &bull; Requested {req.request_date || req.requestDate}
                  </div>
                </div>
                <Badge type={req.status?.includes("Rejected")?"red":req.status==="Fully Approved"?"green":"amber"}>{req.status}</Badge>
              </div>

              <div style={{display:"flex",gap:2,overflowX:"auto",marginBottom:14}}>
                {req.steps.map((step, i) => (
                  <div key={i} style={{flex:"1 1 90px",textAlign:"center",padding:"0 4px"}}>
                    <div style={{
                      width:28,height:28,borderRadius:"50%",margin:"0 auto 6px",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:500,
                      background:step.status==="Approved"?"#0F6E56":step.status==="Rejected"?"#A32D2D":step.status==="Pending"?"var(--color-background-secondary)":"var(--color-background-secondary)",
                      color:step.status==="Approved"||step.status==="Rejected"?"#fff":"var(--color-text-secondary)"
                    }}>
                      {step.status==="Approved"?"✓":step.status==="Rejected"?"✕":i+1}
                    </div>
                    <div style={{fontSize:10,color:step.status==="Approved"?"#0F6E56":step.status==="Rejected"?"#A32D2D":"var(--color-text-secondary)",lineHeight:1.3}}>{step.role}</div>
                    {step.assignee_name && <div style={{fontSize:10,color:"var(--color-text-secondary)",marginTop:2}}>{step.assignee_name}</div>}
                    {!step.assignee_name && <div style={{fontSize:10,color:"var(--color-text-danger)",marginTop:2}}>Unassigned</div>}
                  </div>
                ))}
              </div>

              {req.steps.filter(step => canAct(req, step)).map(step => {
                const key = `${req.id}-${step.step_order}`;
                return (
                  <div key={key} style={{background:"var(--color-background-info)",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,padding:"12px 14px",marginTop:8}}>
                    <div style={{fontSize:13,fontWeight:500,color:"var(--color-text-info)",marginBottom:8}}>
                      Your action needed: {step.role}
                    </div>
                    <input
                      placeholder="Optional comment"
                      value={comments[key] || ""}
                      onChange={e=>setComments({...comments, [key]: e.target.value})}
                      style={{width:"100%",padding:"7px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,fontSize:13,marginBottom:10,boxSizing:"border-box"}}
                    />
                    <div style={{display:"flex",gap:8}}>
                      <button
                        style={S.btn("#0F6E56")} disabled={actingStep===key}
                        onClick={()=>actOnStep(req, step, "approve")}
                      >
                        {actingStep===key ? "…" : "Approve"}
                      </button>
                      <button
                        style={S.btn("#A32D2D")} disabled={actingStep===key}
                        onClick={()=>actOnStep(req, step, "reject")}
                      >
                        {actingStep===key ? "…" : "Reject"}
                      </button>
                    </div>
                  </div>
                );
              })}
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
            This request will initiate the 6-step approval workflow: HOC → HOF → Treasury → Lender HOC → Lender HOF → GCFO, automatically assigned to the real user holding each role.
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