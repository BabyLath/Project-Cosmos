import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { requireAuth, requireCsrfHeader } from "../middleware/auth.middleware";
import { loginRateLimiter, forgotPasswordRateLimiter } from "../middleware/rateLimiter.middleware";

const router = Router();

router.post("/login", loginRateLimiter, requireCsrfHeader, authController.loginHandler);
router.post("/logout", requireCsrfHeader, authController.logoutHandler);
router.get("/me", requireAuth, authController.meHandler);
router.post("/forgot-password", forgotPasswordRateLimiter, requireCsrfHeader, authController.forgotPasswordHandler);
router.post("/reset-password", requireCsrfHeader, authController.resetPasswordHandler);

export default router;
