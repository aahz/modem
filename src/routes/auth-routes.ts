import { Router } from "express";
import { z } from "zod";
import {
  createUser,
  findUserById,
  findUserByUsername,
  updateUserPassword,
} from "../database.js";
import {
  authenticate,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
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

  const validPassword = await verifyPassword(parsed.data.password, user.password_hash);
  if (!validPassword) {
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
      mustChangePassword: user.must_change_password === 1,
    },
  });
});

authRouter.get("/auth/me", authenticate, async (req, res) => {
  res.json({ user: req.principal });
});

authRouter.post("/auth/change-password", authenticate, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const principal = req.principal!;
  if (principal.authType !== "jwt") {
    res.status(403).json({ error: "Password can be changed only with JWT session" });
    return;
  }

  const user = await findUserById(principal.id);
  if (!user || user.is_active === 0) {
    res.status(404).json({ error: "User not found or inactive" });
    return;
  }

  const isCurrentValid = await verifyPassword(
    parsed.data.currentPassword,
    user.password_hash
  );
  if (!isCurrentValid) {
    res.status(401).json({ error: "Current password is invalid" });
    return;
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    res.status(400).json({ error: "New password must be different" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await updateUserPassword({ userId: user.id, passwordHash });

  const refreshedToken = signJwt({
    sub: String(user.id),
    username: user.username,
    role: user.role,
  });

  res.json({
    accessToken: refreshedToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: false,
    },
  });
});

authRouter.post(
  "/users",
  authenticate,
  requirePasswordChanged,
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
      mustChangePassword: true,
    });

    res.status(201).json({
      id: userId,
      username: parsed.data.username,
      role: parsed.data.role,
    });
  }
);
