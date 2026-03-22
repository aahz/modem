import { Router } from "express";
import { z } from "zod";
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from "../database.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { hashToken, randomToken } from "../security.js";

const createTokenSchema = z.object({
  name: z.string().min(2),
  role: z.enum(["admin", "user"]),
});

export const tokenRouter = Router();

tokenRouter.use(authenticate, requireRole("admin"));

tokenRouter.get("/tokens", async (_req, res) => {
  const tokens = await listApiTokens();
  res.json({ items: tokens });
});

tokenRouter.post("/tokens", async (req, res) => {
  const parsed = createTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const rawToken = randomToken(32);
  const tokenHash = hashToken(rawToken);

  const tokenId = await createApiToken({
    name: parsed.data.name,
    role: parsed.data.role,
    tokenHash,
    createdBy: req.principal!.id,
  });

  res.status(201).json({
    id: tokenId,
    name: parsed.data.name,
    role: parsed.data.role,
    token: rawToken,
  });
});

tokenRouter.post("/tokens/:id/revoke", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid token id" });
    return;
  }
  await revokeApiToken(id);
  res.status(204).send();
});
