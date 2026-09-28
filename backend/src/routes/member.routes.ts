import { Router } from "express";
import * as memberController from "../controllers/member.controller";
import { requireAuth, requireRole, requireCsrfHeader } from "../middleware/auth.middleware";

const router = Router();

// Every route requires an authenticated ADMIN or OFFICER. Plain
// MEMBERs never reach this router at all — matches the requirement
// that ordinary members cannot access the member-management API.
router.use(requireAuth, requireRole("ADMIN", "OFFICER"));

router.get("/", memberController.listMembersHandler);
router.get("/:id", memberController.getMemberHandler);
router.post("/", requireCsrfHeader, memberController.createMemberHandler);
router.patch("/:id", requireCsrfHeader, memberController.updateMemberHandler);

// Deactivation is restricted to ADMIN only — officers can edit basic
// member info but not gate account access.
router.patch("/:id/status", requireCsrfHeader, requireRole("ADMIN"), memberController.updateMemberStatusHandler);

export default router;
