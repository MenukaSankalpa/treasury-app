import { Router } from "express";
import { getDeposits, createDeposit } from "../controllers/depositsController.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth);
router.get("/", getDeposits);
router.post("/", createDeposit);
export default router;