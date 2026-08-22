import { Router } from "express";
import {
  getPermissions, togglePageRole, toggleActionRole,
  grantActionEmail, revokeActionEmail, resetPermissions,
} from "../controllers/permissionsController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.get("/", getPermissions); // any logged-in user can read (needed to compute canAccess/canDoAction)
router.use(requireRole("SuperAdmin"));
router.post("/page/toggle", togglePageRole);
router.post("/action/toggle-role", toggleActionRole);
router.post("/action/grant-email", grantActionEmail);
router.post("/action/revoke-email", revokeActionEmail);
router.post("/reset", resetPermissions);
export default router;