import { Router } from "express";
import { getNotifications, markRead, markAllRead } from "../controllers/notificationsController.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth);
router.get("/", getNotifications);
router.post("/:id/read", markRead);
router.post("/read-all", markAllRead);
export default router;