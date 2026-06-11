import "dotenv/config";
import express from "express";
import http from "node:http";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import uploadsRoutes from "./routes/uploads.js";
import resourcesRoutes from "./routes/resources.js";
import adminRoutes from "./routes/admin.js";
import { initIO } from "./sockets/io.js";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./lib/openapi.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false, // Swagger UI inline styles
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") ?? true,
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, max: 600 }));

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/api/docs.json", (_req, res) => res.json(openapiSpec));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customSiteTitle: "HelpDesk API",
  swaggerOptions: { persistAuthorization: true },
}));
app.use("/api/auth", authRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", resourcesRoutes);

app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Error interno" });
});

const server = http.createServer(app);
initIO(server);

const PORT = Number(process.env.PORT ?? 3001);
server.listen(PORT, () => console.log(`[helpdesk-backend] :${PORT}`));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[${sig}] cerrando...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
