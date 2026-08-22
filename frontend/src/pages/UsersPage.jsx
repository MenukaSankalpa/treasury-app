import { useState, useEffect } from "react";
import { COMPANIES } from "../constants";
import { ROLES } from "../permissions";
import { GlassCard, Badge, Table, Modal, Field, FormRow, PageHeader, S } from "../components/UI";
import { usersApi } from "../api/users";
import { MOCK_USERS } from "../mockUsers";
import { USE_MOCK } from "../config";

const COMPANY_SCOPED_ROLES = ["TeamMember","Accountant","CompanyHead"];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const blank = {name:"",email:"",password:"",role:"Accountant",company:"",active:true};
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      if (USE_MOCK) {
        setUsers(MOCK_USERS.map(({password, ...u}) => ({...u, active:true, created_at:""})));
      } else {
        setUsers(await usersApi.list());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(blank); setModal("add"); setError(""); };
  const openEdit = (u) => { setForm({...u, password:""}); setModal(u); setError(""); };

  const save = async () => {
    setSaving(true); setError("");
    try {
      if (USE_MOCK) { setError("User Management writes require the real backend — this is display-only in mock mode."); return; }
      if (modal === "add") await usersApi.create(form);
      else await usersApi.update(modal.id, { name: form.name, role: form.role, company: form.company, active: form.active });
      await load();
      setModal(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    if (USE_MOCK) { alert("User removal requires the real backend."); return; }
    if (!confirm(`Remove ${u.name}? They will lose access immediately.`)) return;
    await usersApi.remove(u.id);
    load();
  };

  const roleColor = (role) => ({
    SuperAdmin:"red", TeamMember:"gray", Accountant:"blue", CompanyHead:"amber", Treasury:"green", FinanceController:"gray", GCFO:"gray",
  }[role] || "gray");

  return (
    <div>
      <PageHeader title="User Management">
        <button style={S.btn("#185FA5")} onClick={openAdd}>+ Add user</button>
      </PageHeader>

      <GlassCard>
        {loading ? (
          <div style={{padding:24, color:"var(--color-text-secondary)"}}>Loading users…</div>
        ) : (
          <Table
            cols={[
              {key:"empId",label:"Employee ID"},
              {key:"name",label:"Name"},
              {key:"email",label:"Email"},
              {key:"role",label:"Role",render:v=><Badge type={roleColor(v)}>{v}</Badge>},
              {key:"company",label:"Company",render:v=>v||"—"},
              {key:"active",label:"Status",render:v=><Badge type={v?"green":"red"}>{v?"Active":"Disabled"}</Badge>},
              {key:"id",label:"",render:(_,u)=>(
                <div style={{display:"flex",gap:6}}>
                  <button onClick={e=>{e.stopPropagation();openEdit(u)}} style={{padding:"3px 10px",borderRadius:6,border:"0.5px solid var(--color-border-info)",background:"var(--color-background-info)",color:"var(--color-text-info)",cursor:"pointer",fontSize:12}}>Edit</button>
                  <button onClick={e=>{e.stopPropagation();remove(u)}} style={{padding:"3px 10px",borderRadius:6,border:"0.5px solid #f0c0c0",background:"var(--color-background-danger)",color:"var(--color-text-danger)",cursor:"pointer",fontSize:12}}>Remove</button>
                </div>
              )},
            ]}
            rows={users}
          />
        )}
      </GlassCard>

      {modal && (
        <Modal title={modal === "add" ? "Add user" : `Edit ${modal.name}`} onClose={()=>setModal(null)}>
          {modal === "add" && <Field label="Email" type="email" value={form.email} onChange={v=>setForm({...form,email:v})} />}
          <Field label="Full name" value={form.name} onChange={v=>setForm({...form,name:v})} />
          {modal === "add" && <Field label="Temporary password" type="password" value={form.password} onChange={v=>setForm({...form,password:v})} />}
          <FormRow>
            <div style={{flex:1}}><Field label="Role" type="select" value={form.role} onChange={v=>setForm({...form,role:v})} options={ROLES} /></div>
            {COMPANY_SCOPED_ROLES.includes(form.role) && (
              <div style={{flex:1}}><Field label="Company" type="select" value={form.company} onChange={v=>setForm({...form,company:v})} options={COMPANIES} /></div>
            )}
          </FormRow>
          {modal !== "add" && <Field label="Status" type="select" value={String(form.active)} onChange={v=>setForm({...form,active:v==="true"})} options={["true","false"]} />}
          {error && <div style={{background:"var(--color-background-danger)", color:"var(--color-text-danger)", padding:"9px 12px", borderRadius:8, fontSize:13, marginBottom:14}}>{error}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnGhost} onClick={()=>setModal(null)}>Cancel</button>
            <button style={S.btn("#185FA5")} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}