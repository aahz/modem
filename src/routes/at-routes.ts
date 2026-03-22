import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { writeCommandLog } from "../database.js";
import { authenticate, requirePasswordChanged } from "../middleware/auth.js";
import {
  isUserCommandAllowed,
  normalizeAtCommand,
} from "../services/at-policy.js";
import { modemService } from "../services/modem-service.js";

const sendAtSchema = z.object({
  command: z.string().min(1),
  timeoutMs: z.number().int().positive().max(60000).optional(),
});

export const atRouter = Router();

atRouter.use(authenticate, requirePasswordChanged);

atRouter.get("/modem/status", async (_req, res) => {
  res.json(modemService.status());
});

atRouter.post("/at/send", async (req, res) => {
  const parsed = sendAtSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const principal = req.principal!;
  const command = normalizeAtCommand(parsed.data.command);

  if (
    principal.role === "user" &&
    !isUserCommandAllowed(command, config.userAllowedCommands)
  ) {
    await writeCommandLog({
      actorUserId: principal.id,
      actorTokenId: principal.tokenId ?? null,
      actorUsername: principal.username,
      actorRole: principal.role,
      command,
      status: "blocked",
      error: "Command is not allowed for role=user",
    });
    res.status(403).json({
      error: "Command is blocked for user role",
      allowedCommands: config.userAllowedCommands,
    });
    return;
  }

  try {
    const result = await modemService.sendCommand(
      command,
      parsed.data.timeoutMs ?? 5000
    );

    await writeCommandLog({
      actorUserId: principal.id,
      actorTokenId: principal.tokenId ?? null,
      actorUsername: principal.username,
      actorRole: principal.role,
      command,
      response: result.response,
      status: "ok",
      durationMs: result.durationMs,
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeCommandLog({
      actorUserId: principal.id,
      actorTokenId: principal.tokenId ?? null,
      actorUsername: principal.username,
      actorRole: principal.role,
      command,
      status: "error",
      error: message,
    });

    res.status(502).json({ error: "AT command failed", details: message });
  }
});
