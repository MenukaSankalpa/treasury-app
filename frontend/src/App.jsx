import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { USE_MOCK } from "./config";
import { PAGE_ACCESS, canAccess, firstAllowedPage } from "./permissions";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import LoansPage from "./pages/LoansPage";
import DepositsPage from "./pages/DepositsPage";
import BalancesPage from "./pages/BalancesPage";
import IntercompanyPage from "./pages/IntercompanyPage";
import RatePage from "./pages/RatePage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import { loansApi, depositsApi, intercompanyApi, ratesApi, balancesApi } from "./api/treasury";
import { INIT_LOANS, INIT_DEPOSITS, INIT_IC, INIT_APPROVALS, INIT_RATES, INIT_BALANCES } from "./mockData";

const NAV_META = {
  dashboard:    {icon:"ti-dashboard",        label:"Dashboard"},
  loans:        {icon:"ti-credit-card",      label:"Loans & borrowings"},
  deposits:     {icon:"ti-building-bank",    label:"Deposits"},
  balances:     {icon:"ti-wallet",           label:"Bank Balances"},
  intercompany: {icon:"ti-arrows-exchange",  label:"Intercompany"},
  rates:        {icon:"ti-chart-line",       label:"Rate registry"},
  reports:      {icon:"ti-report-analytics", label:"Reports"},
  users:        {icon:"ti-users",            label:"User Management"},
};

function MainApp() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState(() => firstAllowedPage(user.role));
  const [loans, setLoans] = useState(USE_MOCK ? INIT_LOANS : []);
  const [deposits, setDeposits] = useState(USE_MOCK ? INIT_DEPOSITS : []);
  const [balances, setBalances] = useState(USE_MOCK ? INIT_BALANCES : []);
  const [icLoans, setIcLoans] = useState(USE_MOCK ? INIT_IC : []);
  const [approvals, setApprovals] = useState(USE_MOCK ? INIT_APPROVALS : []);
  const [rates, setRates] = useState(USE_MOCK ? INIT_RATES : []);
  const [loading, setLoading] = useState(!USE_MOCK);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (USE_MOCK) return;
    async function loadAll() {
      try {
        const [l, d, b, ic, appr, r] = await Promise.all([
          loansApi.list(), depositsApi.list(), balancesApi.list(),
          intercompanyApi.listLoans(), intercompanyApi.listApprovals(), ratesApi.list(),
        ]);
        setLoans(l); setDeposits(d); setBalances(b); setIcLoans(ic); setApprovals(appr); setRates(r);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const nav = Object.keys(NAV_META).filter(key => canAccess(user.role, key));
  const safePage = canAccess(user.role, page) ? page : firstAllowedPage(user.role);

  if (loading) return <div style={{padding:40,color:"var(--color-text-secondary)"}}>Loading treasury data…</div>;
  if (error) return <div style={{padding:40,color:"#A32D2D"}}>Failed to load data: {error}</div>;

  const PAGES = {
    dashboard: <Dashboard loans={loans} deposits={deposits} icLoans={icLoans} rates={rates} />,
    loans: <LoansPage loans={loans} setLoans={setLoans} />,
    deposits: <DepositsPage deposits={deposits} setDeposits={setDeposits} />,
    balances: <BalancesPage balances={balances} setBalances={setBalances} />,
    intercompany: <IntercompanyPage icLoans={icLoans} setIcLoans={setIcLoans} approvals={approvals} setApprovals={setApprovals} />,
    rates: <RatePage rates={rates} setRates={setRates} />,
    reports: <ReportsPage loans={loans} deposits={deposits} rates={rates} icLoans={icLoans} balances={balances} />,
    users: <UsersPage />,
  };

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"var(--font-sans)",background:"var(--color-background-tertiary)"}}>
      <div style={{width:224,background:"#0A1628",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 18px 16px"}}>
          <div style={{color:"#5DCAA5",fontSize:10,fontWeight:500,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>CHL Group</div>
          <div style={{color:"#fff",fontSize:15,fontWeight:500}}>Treasury Module</div>
          <div style={{color:"#475569",fontSize:11,marginTop:2}}>{USE_MOCK ? "Mock data mode" : "Acumatica integration ready"}</div>
        </div>
        <nav style={{padding:"0 10px",flex:1,overflowY:"auto"}}>
          {nav.map(key => {
            const meta = NAV_META[key];
            const isActive = safePage === key;
            return (
              <button key={key} onClick={()=>setPage(key)} style={{
                display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 10px",
                background:isActive?"rgba(29,158,117,0.15)":"transparent",
                color:isActive?"#5DCAA5":"#64748B",
                border:"none",borderRadius:8,cursor:"pointer",fontSize:13,
                fontWeight:isActive?500:400,textAlign:"left",marginBottom:2,
                borderLeft:isActive?"2px solid #5DCAA5":"2px solid transparent",
              }}>
                <i className={`ti ${meta.icon}`} style={{fontSize:16}} aria-hidden="true" />
                {meta.label}
              </button>
            );
          })}
        </nav>
        <div style={{padding:"14px 18px",borderTop:"0.5px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:"#1D9E75",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:600,flexShrink:0}}>
              {user.name.split(" ").map(p=>p[0]).slice(0,2).join("")}
            </div>
            <div style={{overflow:"hidden"}}>
              <div style={{color:"#fff",fontSize:12,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
              <div style={{color:"#64748B",fontSize:10}}>{user.role}{user.company ? ` · ${user.company}` : ""}</div>
            </div>
          </div>
          <button onClick={logout} style={{
            width:"100%",padding:"7px",borderRadius:8,border:"0.5px solid rgba(255,255,255,0.1)",
            background:"transparent",color:"#94A3B8",fontSize:12,cursor:"pointer",
          }}>
            Log out
          </button>
        </div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:24}}>
        {PAGES[safePage]}
      </div>
    </div>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--color-text-secondary)"}}>Loading…</div>;
  return user ? <MainApp /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}