import { Router } from "express";
import { listCommandLogs } from "../database.js";
import { commandLogEvents, CommandLogEvent } from "../log-events.js";
import {
  authenticate,
  authenticateToken,
  requirePasswordChanged,
} from "../middleware/auth.js";

export const logRouter = Router();

logRouter.use(authenticate, requirePasswordChanged);

logRouter.get("/logs", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);
  const principal = req.principal!;

  const logs =
    principal.role === "admin"
      ? await listCommandLogs({ limit })
      : await listCommandLogs({ limit, actorUserId: principal.id });

  res.json({ items: logs });
});

logRouter.get("/logs/stream", async (req, res) => {
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
