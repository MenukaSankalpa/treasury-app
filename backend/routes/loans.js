import { Router } from "express";
import { getLoans, createLoan, decideAccountant, decideCompanyHead, decideLoan, updateLoan } from "../controllers/loansController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", getLoans);
router.post("/", requireRole("TeamMember"), createLoan);
router.post("/:id/accountant", requireRole("Accountant"), decideAccountant);
router.post("/:id/company-head", requireRole("CompanyHead"), decideCompanyHead);
router.post("/:id/decide", requireRole("Treasury"), decideLoan);
router.put("/:id", requireRole("Treasury"), updateLoan);

export default router;