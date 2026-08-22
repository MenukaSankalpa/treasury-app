import { useAuth } from "../context/AuthContext";
import IntercompanyCompany from "./intercompany/IntercompanyCompany";
import IntercompanyReview from "./intercompany/IntercompanyReview";

const COMPANY_SCOPED_ROLES = ["TeamMember", "Accountant", "CompanyHead"];

export default function IntercompanyPage({icLoans, setIcLoans}) {
  const { user } = useAuth();

  if (COMPANY_SCOPED_ROLES.includes(user.role)) {
    return <IntercompanyCompany icLoans={icLoans} setIcLoans={setIcLoans} />;
  }
  return <IntercompanyReview icLoans={icLoans} setIcLoans={setIcLoans} />;
}