import { NextFunction, Request, Response } from "express";
import {
  findApiTokenByHash,
  findUserById,
  touchApiTokenLastUsed,
} from "../database.js";
import { hashToken, verifyJwt } from "../security.js";
import { Role } from "../types.js";

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }
    const principal = await authenticateToken(token);
    if (!principal) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.principal = principal;
    next();
  } catch (error) {
    res.status(401).json({
      error: "Unauthorized",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function authenticateToken(token: string) {
  if (token.split(".").length === 3) {
    const payload = verifyJwt(token);
    const userId = Number(payload.sub);
    const user = await findUserById(userId);
    if (!user || user.is_active === 0) {
      return null;
    }
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      authType: "jwt" as const,
      mustChangePassword: user.must_change_password === 1,
    };
  }

  const tokenHash = hashToken(token);
  const apiToken = await findApiTokenByHash(tokenHash);
  if (!apiToken) {
    return null;
  }

  const owner = await findUserById(apiToken.created_by);
  if (!owner || owner.is_active === 0) {
    return null;
  }

  await touchApiTokenLastUsed(apiToken.id);
  return {
    id: owner.id,
    username: owner.username,
    role: apiToken.role,
    authType: "api_token" as const,
    tokenId: apiToken.id,
    mustChangePassword: owner.must_change_password === 1,
  };
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const principal = req.principal;
    if (!principal) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(principal.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requirePasswordChanged(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const principal = req.principal;
  if (!principal) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (principal.mustChangePassword) {
    res.status(403).json({
      error: "Password change required",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
    return;
  }
  next();
}
