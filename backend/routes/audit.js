import { Router } from "express";
import { getAuditLog } from "../controllers/auditController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth, requireRole("GCFO","FinanceController"));
router.get("/", getAuditLog);
export default router;