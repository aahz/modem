import fs from "fs";
import express from "express";
import { createServer } from "http";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { RawData, WebSocket, WebSocketServer } from "ws";
import { config } from "./config.js";
import { getDb } from "./database.js";
import { commandLogEvents, CommandLogEvent } from "./log-events.js";
import { authenticateToken } from "./middleware/auth.js";
import { createRateLimit } from "./middleware/rate-limit.js";
import { atRouter } from "./routes/at-routes.js";
import { authRouter } from "./routes/auth-routes.js";
import { logRouter } from "./routes/log-routes.js";
import { tokenRouter } from "./routes/token-routes.js";
import { modemService } from "./services/modem-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveUiPath(): string {
  const builtUiPath = path.resolve(__dirname, "../dist-ui");
  if (fs.existsSync(builtUiPath)) {
    return builtUiPath;
  }
  return path.resolve(__dirname, "../src/ui");
}

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

  app.get("/api/v1/logs/stream", async (req, res) => {
    const queryToken = typeof req.query.token === "string" ? req.query.token : null;
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : null;
    const token = queryToken || headerToken;

    if (!token) {
      res.status(401).json({ error: "Missing token for stream" });
      return;
    }

    const principal = await authenticateToken(token);
    if (!principal) {
      res.status(401).json({ error: "Unauthorized stream token" });
      return;
    }
    if (principal.mustChangePassword) {
      res.status(403).json({
        error: "Password change required",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write("event: ready\ndata: {}\n\n");

    const listener = (event: CommandLogEvent) => {
      if (principal.role !== "admin" && event.actor_user_id !== principal.id) {
        return;
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    commandLogEvents.on(listener);
    req.on("close", () => {
      commandLogEvents.off(listener);
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

  const uiPath = resolveUiPath();
  app.use("/ui", express.static(uiPath));
  app.get("/ui/*", (_req, res) => {
    res.sendFile(path.join(uiPath, "index.html"));
  });
  app.get("/", (_req, res) => {
    res.redirect("/ui");
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Unhandled error", details: error.message });
  });

  const server = createServer(app);
  const wsServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    try {
      const host = request.headers.host ?? "localhost";
      const url = new URL(request.url ?? "", `http://${host}`);
      if (url.pathname !== "/ws/modem") {
        socket.destroy();
        return;
      }

      const token = url.searchParams.get("token");
      if (!token) {
        socket.destroy();
        return;
      }

      const principal = await authenticateToken(token);
      if (
        !principal ||
        principal.role !== "admin" ||
        principal.mustChangePassword
      ) {
        socket.destroy();
        return;
      }

      wsServer.handleUpgrade(request, socket, head, async (ws: WebSocket) => {
        try {
          const sendSafe = (payload: Record<string, unknown>) => {
            if (ws.readyState !== WebSocket.OPEN) {
              return;
            }
            try {
              ws.send(JSON.stringify(payload));
            } catch {
              // ignore socket send errors for already-closing clients
            }
          };

          const atMode = await modemService.ensureAtCommandMode();
          const session = await modemService.openInteractiveSession({
            onData: (chunk) => {
              sendSafe({ type: "data", data: chunk });
            },
            onSystem: (message) => {
              sendSafe({ type: "system", data: message });
            },
          });

          sendSafe({ type: "system", data: atMode.message });

          ws.on("message", async (data: RawData) => {
            try {
              const chunk =
                typeof data === "string" ? data : data.toString("utf8");
              await session.write(chunk);
            } catch (error) {
              sendSafe({
                type: "system",
                data: error instanceof Error ? error.message : String(error),
              });
            }
          });

          ws.on("close", () => session.close());
          ws.on("error", () => session.close());
        } catch {
          ws.close();
        }
      });
    } catch {
      socket.destroy();
    }
  });

  server.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal bootstrap error:", error);
  process.exit(1);
});
