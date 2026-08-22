import { useAuth } from "../context/AuthContext";
import LoansPageCompany from "./loans/LoansPageCompany";
import LoansPageTreasury from "./loans/LoansPageTreasury";

const COMPANY_SCOPED_ROLES = ["TeamMember", "Accountant", "CompanyHead"];

export default function LoansPage({loans, setLoans}) {
  const { user } = useAuth();

  if (COMPANY_SCOPED_ROLES.includes(user.role)) {
    return <LoansPageCompany loans={loans} setLoans={setLoans} />;
  }
  // Treasury, GCFO, FinanceController, SuperAdmin all get the review-only, all-companies view.
  return <LoansPageTreasury loans={loans} setLoans={setLoans} />;
}