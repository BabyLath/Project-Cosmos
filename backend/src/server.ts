import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import memberRoutes from "./routes/member.routes";
import { errorHandler } from "./middleware/errorHandler.middleware";

export const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true, // required for the browser to send/receive the session cookie
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);

// 404 for unmatched API routes
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

app.use(errorHandler);

if (require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`OMS backend listening on http://localhost:${env.PORT}`);
  });
}
