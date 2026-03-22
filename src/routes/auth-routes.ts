import { Router } from "express";
import { z } from "zod";
import { createUser, findUserByUsername } from "../database.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { hashPassword, signJwt, verifyPassword } from "../security.js";
import { Role } from "../types.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(["admin", "user"]),
});

export const authRouter = Router();

authRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const user = await findUserByUsername(parsed.data.username);
  if (!user || user.is_active === 0) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signJwt({
    sub: String(user.id),
    username: user.username,
    role: user.role,
  });

  res.json({
    accessToken: token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

authRouter.get("/auth/me", authenticate, async (req, res) => {
  res.json({ user: req.principal });
});

authRouter.post(
  "/users",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    const existing = await findUserByUsername(parsed.data.username);
    if (existing) {
      res.status(409).json({ error: "Username already exists" });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const userId = await createUser({
      username: parsed.data.username,
      passwordHash,
      role: parsed.data.role as Role,
    });

    res.status(201).json({
      id: userId,
      username: parsed.data.username,
      role: parsed.data.role,
    });
  }
);
