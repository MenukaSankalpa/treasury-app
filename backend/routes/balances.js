import { Router } from "express";
import { getBalances, saveBalance } from "../controllers/balancesController.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth);
router.get("/", getBalances);
router.post("/", saveBalance);
export default router;