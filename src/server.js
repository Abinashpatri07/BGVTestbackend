import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";

// ───────── AUTH & OCR ─────────
import unifiedAuthRoutes from "./routes/unifiedAuthRoutes.js";
import ocrRoutes from "./routes/ocrRoutes.js";

// ───────── CLIENT ADMIN ROUTES ─────────
import clientAdminHrRoutes from "./routes/clientadminroute/hrRoutes.js";
import clientAdminCandidateRoutes from "./routes/clientadminroute/candidateRoutes.js";
import clientAdminAuthRoutes from "./routes/clientadminroute/authRoutes.js";
import clientAdminDashboardRoutes from "./routes/clientadminroute/dashboardRoutes.js";
import clientAdminBillingRoutes from "./routes/clientadminroute/billingRoutes.js";
import clientAdminAnalyticsRoutes from "./routes/clientadminroute/analyticsRoutes.js";

dotenv.config();

import pool from "./config/db.js";

const app = express();

/* MIDDLEWARE */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://bgv.dqnex.online",
      "http://187.126.122.110",
      "http://187.126.122.110:5173",
      "http://187.126.122.110:5174",
    ],
    credentials: true,
  })
);
app.use(express.json());

const uploadsDirectory = path.resolve("uploads");
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

// Serve uploads — images & PDFs accessible at /uploads/<filename>
app.use(
  "/uploads",
  express.static(uploadsDirectory, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".pdf")) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
      }
    },
  })
);

// Fallback: proxy from production server if file not found locally
app.use("/uploads", async (req, res) => {
  const remoteBase = (process.env.REMOTE_UPLOADS_URL || "https://api.dqnex.online").replace(/\/+$/, "");
  const remoteUrl = `${remoteBase}/uploads${req.path}`;
  try {
    const remoteRes = await fetch(remoteUrl);
    if (!remoteRes.ok) {
      return res.status(remoteRes.status).send("File not found");
    }
    const contentType = remoteRes.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    if (req.path.toLowerCase().endsWith(".pdf")) {
      res.setHeader("Content-Disposition", "inline");
    }
    const arrayBuffer = await remoteRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Uploads proxy error:", err.message);
    return res.status(404).send("File not found");
  }
});

/* SWAGGER DOCS */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

/* ───────── UNIFIED AUTH ROUTES ───────── */
app.use("/api/auth", unifiedAuthRoutes);

/* ───────── CLIENT ADMIN ROUTES ───────── */
app.use("/api/client-admin/hr", clientAdminHrRoutes);
app.use("/api/client-admin/candidate", clientAdminCandidateRoutes);
app.use("/api/client-admin/auth", clientAdminAuthRoutes);
app.use("/api/client-admin/dashboard", clientAdminDashboardRoutes);
app.use("/api/client-admin/billing", clientAdminBillingRoutes);
app.use("/api/client-admin/analytics", clientAdminAnalyticsRoutes);

/* ───────── OCR ROUTES ───────── */
app.use("/api/ocr", ocrRoutes);

/* TEST */
app.get("/", (req, res) => {
  res.send("Client Admin Backend Server Running 🚀");
});

/* ───────── FRONTEND RESET / SETUP REDIRECTS (FALLBACK) ───────── */
const passwordResetPaths = [
  "/reset-password",
  "/setup-password",
  "/admin/reset-password",
  "/admin/setup-password",
  "/admin/client-setup-password",
  "/client-setup-password",
];

passwordResetPaths.forEach((routePath) => {
  app.get(routePath, (req, res) => {
    const isDev = req.hostname === "localhost" || req.hostname === "127.0.0.1";
    const frontendBase = isDev
      ? "http://localhost:5174"
      : process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes("localhost")
      ? process.env.FRONTEND_URL.replace(/\/+$/, "")
      : "https://bgv.dqnex.online";
    return res.redirect(`${frontendBase}${req.originalUrl}`);
  });
});

/* PORT */
const PORT = process.env.PORT || 5001;

pool.getConnection()
  .then(() => {
    console.log("MariaDB Connected ✅");
  })
  .catch((err) => {
    console.log("DB Connection Error ❌", err);
  });

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Client Admin Server running on port ${PORT}`);
});
