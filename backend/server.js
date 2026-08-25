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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Treasury API running on port ${PORT}`));