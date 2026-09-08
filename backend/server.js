import express from "express";
import cors from "cors";
import "dotenv/config";

import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import loansRoutes from "./routes/loans.js";
import depositsRoutes from "./routes/deposits.js";
import balancesRoutes from "./routes/balances.js";
import ratesRoutes from "./routes/rates.js";
import intercompanyRoutes from "./routes/intercompany.js";
import notificationsRoutes from "./routes/notifications.js";
import auditRoutes from "./routes/audit.js";
import permissionsRoutes from "./routes/permissions.js";
import uploadRoutes from "./routes/upload.js";

// SAFETY NET: catch any error that would otherwise crash the whole
// process (like an unhandled JSON.parse failure inside a route), log it,
// and keep the server running instead of taking down every endpoint.
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION (server kept alive):", err);
});
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION (server kept alive):", err);
});

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map(s=>s.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (req,res) => res.json({ status:"ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/loans", loansRoutes);
app.use("/api/deposits", depositsRoutes);
app.use("/api/balances", balancesRoutes);
app.use("/api/rates", ratesRoutes);
app.use("/api/intercompany", intercompanyRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/permissions", permissionsRoutes);
app.use("/api/upload", uploadRoutes);

// SAFETY NET: catches any error thrown inside a route that wasn't already
// caught by that route's own try/catch, and returns a normal error
// response instead of crashing the process.
app.use((err, req, res, next) => {
  console.error("Unhandled route error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Treasury API running on port ${PORT}`));