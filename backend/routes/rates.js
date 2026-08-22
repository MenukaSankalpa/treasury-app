import { Router } from "express";
import { getRates, saveRate } from "../controllers/ratesController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth);
router.get("/", getRates);
router.post("/", requireRole("Treasury"), saveRate);
export default router;