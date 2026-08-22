import { Router } from "express";
import {
  getIcLoans, getIcLoan, createIcLoan, updateIcLoan, accountantDecide, companyHeadDecide,
  treasuryDecide, lenderDecide, releasePayment, addNewRate, bulkCreate,
  initiateSettle, settlementDecide,
} from "../controllers/intercompanyController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/loans", getIcLoans);
router.get("/loans/:id", getIcLoan);
router.post("/loans", requireRole("TeamMember"), createIcLoan);
router.put("/loans/:id", requireRole("Treasury","FinanceController","SuperAdmin"), updateIcLoan);
router.post("/loans/bulk", requireRole("TeamMember"), bulkCreate);
router.post("/loans/:id/accountant", requireRole("Accountant"), accountantDecide);
router.post("/loans/:id/company-head", requireRole("CompanyHead"), companyHeadDecide);
router.post("/loans/:id/treasury", requireRole("Treasury"), treasuryDecide);
router.post("/loans/:id/lender", requireRole("CompanyHead","Accountant"), lenderDecide);
router.post("/loans/:id/release", requireRole("FinanceController"), releasePayment);
router.post("/loans/:id/settle/initiate", requireRole("Treasury","Accountant","CompanyHead"), initiateSettle);
router.post("/loans/:id/settle/decide", requireRole("Accountant","CompanyHead","FinanceController"), settlementDecide);
router.post("/loans/:id/new-rate", requireRole("Treasury"), addNewRate);

export default router;