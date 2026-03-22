import { Router } from "express";
import { listCommandLogs } from "../database.js";
import { authenticate } from "../middleware/auth.js";

export const logRouter = Router();

logRouter.use(authenticate);

logRouter.get("/logs", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);
  const principal = req.principal!;

  const logs =
    principal.role === "admin"
      ? await listCommandLogs({ limit })
      : await listCommandLogs({ limit, actorUserId: principal.id });

  res.json({ items: logs });
});
