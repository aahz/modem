import express from "express";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { getDb } from "./database.js";
import { createRateLimit } from "./middleware/rate-limit.js";
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

  app.use("/api/v1", authRouter);
  app.use("/api/v1", tokenRouter);
  app.use("/api/v1", logRouter);
  app.use(
    "/api/v1",
    createRateLimit({ windowMs: 60_000, max: 60 }),
    atRouter
  );

  app.use("/ui", express.static(path.resolve(__dirname, "../src/ui")));
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
