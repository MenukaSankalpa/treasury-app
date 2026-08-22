import { useAuth } from "../context/AuthContext";
import DashboardCompany from "./dashboard/DashboardCompany";
import DashboardAll from "./dashboard/DashboardAll";

const COMPANY_SCOPED_ROLES = ["TeamMember", "Accountant", "CompanyHead"];

export default function Dashboard({loans, deposits, icLoans, rates, balances}) {
  const { user } = useAuth();

  if (COMPANY_SCOPED_ROLES.includes(user.role)) {
    return <DashboardCompany loans={loans} deposits={deposits} icLoans={icLoans} rates={rates} balances={balances} />;
  }
  // Treasury, GCFO, FinanceController, SuperAdmin get the full multi-company view.
  return <DashboardAll loans={loans} deposits={deposits} icLoans={icLoans} rates={rates} balances={balances} />;
}