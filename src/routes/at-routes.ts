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
  timeoutMs: z.number().int().positive().max(120000).optional(),
});

const acquireSchema = z.object({
  timeoutMs: z.number().int().positive().max(600000).optional(),
});

export const atRouter = Router();

atRouter.use(authenticate, requirePasswordChanged);

atRouter.get("/modem/status", async (_req, res) => {
  try {
    modemService.touchLease(_req.principal!);
  } catch {
    // status remains available even without lease or when owned by another session
  }
  res.json(modemService.status());
});

atRouter.post("/acquire", async (req, res) => {
  const parsed = acquireSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const principal = req.principal!;
  const acquired = await modemService.acquire(
    principal,
    parsed.data.timeoutMs ?? config.acquireTimeoutMs
  );
  if (!acquired.acquired) {
    res.status(423).json({
      error: acquired.reason ?? "Modem is already acquired",
      lease: acquired.lease,
    });
    return;
  }

  res.json({
    ok: true,
    lease: acquired.lease,
  });
});

atRouter.post("/release", async (req, res) => {
  const principal = req.principal!;
  const released = modemService.release(principal);
  if (!released.released) {
    res.status(423).json({ error: released.reason ?? "Modem is acquired by another session" });
    return;
  }
  res.json({ ok: true });
});

atRouter.get("/modem/mode", async (_req, res) => {
  const principal = _req.principal!;
  try {
    modemService.touchLease(principal);
  } catch (error) {
    res.status(423).json({
      error: "Modem lease is required",
      details: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  try {
    const atModeReady = await modemService.checkAtCommandMode();
    res.json({ atModeReady });
  } catch (error) {
    res.status(502).json({
      error: "Failed to check modem mode",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

atRouter.post("/modem/recover-mode", async (_req, res) => {
  const principal = _req.principal!;
  try {
    modemService.touchLease(principal);
  } catch (error) {
    res.status(423).json({
      error: "Modem lease is required",
      details: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  try {
    const result = await modemService.recoverAtCommandMode();
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: "Failed to recover modem mode",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

atRouter.post("/at/send", async (req, res) => {
  const parsed = sendAtSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const principal = req.principal!;
  try {
    modemService.touchLease(principal);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    await writeCommandLog({
      actorUserId: principal.id,
      actorTokenId: principal.tokenId ?? null,
      actorUsername: principal.username,
      actorRole: principal.role,
      command: normalizeAtCommand(parsed.data.command),
      status: "blocked",
      error: details,
    });
    res.status(423).json({
      error: "Modem lease is required",
      details,
    });
    return;
  }

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
