import express from "express";
import morgan from "morgan";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { cleanupOldCommandLogs, getDb } from "./database.js";
import { authenticateToken } from "./middleware/auth.js";
import { createRateLimit } from "./middleware/rate-limit.js";
import { openApiDocument } from "./openapi.js";
import { atRouter } from "./routes/at-routes.js";
import { authRouter } from "./routes/auth-routes.js";
import { logRouter } from "./routes/log-routes.js";
import { tokenRouter } from "./routes/token-routes.js";
import { modemService } from "./services/modem-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap(): Promise<void> {
  await getDb();
  await modemService.connect();

  const runLogsCleanup = async (): Promise<void> => {
    try {
      const deleted = await cleanupOldCommandLogs(config.logRetentionDays);
      if (deleted > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[maintenance] deleted ${deleted} log rows older than ${config.logRetentionDays} days`
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        "[maintenance] failed to cleanup old logs:",
        error instanceof Error ? error.message : String(error)
      );
    }
  };
  await runLogsCleanup();
  const cleanupTimer = setInterval(runLogsCleanup, 6 * 60 * 60 * 1000);
  cleanupTimer.unref();

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(
    morgan((tokens, req, res) => {
      const durationMs = tokens["response-time"](req, res);
      return JSON.stringify({
        method: tokens.method(req, res),
        path: tokens.url(req, res),
        status: Number(tokens.status(req, res)),
        contentLength: Number(tokens.res(req, res, "content-length") || 0),
        durationMs: Number(durationMs || 0),
      });
    })
  );

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      modem: modemService.status(),
    });
  });

  const requireAdminDocsAccess: express.RequestHandler = async (
    req,
    res,
    next
  ) => {
    const queryToken =
      typeof req.query.token === "string" ? req.query.token : null;
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : null;
    const token = queryToken || headerToken;

    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    try {
      const principal = await authenticateToken(token);
      if (!principal) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (principal.role !== "admin" || principal.mustChangePassword) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    } catch (error) {
      res.status(401).json({
        error: "Unauthorized",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  app.get("/openapi.json", requireAdminDocsAccess, (_req, res) => {
    res.json(openApiDocument);
  });
  app.use("/docs", ...swaggerUi.serve);
  app.get("/docs", requireAdminDocsAccess, swaggerUi.setup(openApiDocument));

  app.use("/api/v1", authRouter);
  app.use("/api/v1", tokenRouter);
  app.use("/api/v1", logRouter);
  app.use(
    "/api/v1",
    createRateLimit({ windowMs: 60000, max: 150 }),
    atRouter
  );

  const uiPath = path.resolve(__dirname, "../dist-ui");
  app.use("/ui", express.static(uiPath));
  app.get("/ui/*", (_req, res) => {
    res.sendFile(path.join(uiPath, "index.html"), (error) => {
      if (!error) {
        return;
      }
      res.status(503).json({
        error: "UI build not found",
        details: "Build frontend first (yarn build) or run Vite dev server (yarn dev:ui).",
      });
    });
  });
  app.get("/", (_req, res) => {
    res.redirect("/ui");
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Unhandled error", details: error.message });
  });
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal bootstrap error:", error);
  process.exit(1);
});
