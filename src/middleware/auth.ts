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

    if (token.split(".").length === 3) {
      const payload = verifyJwt(token);
      const userId = Number(payload.sub);
      const user = await findUserById(userId);
      if (!user || user.is_active === 0) {
        res.status(401).json({ error: "Invalid user for JWT token" });
        return;
      }
      req.principal = {
        id: user.id,
        username: user.username,
        role: user.role,
        authType: "jwt",
      };
      next();
      return;
    }

    const tokenHash = hashToken(token);
    const apiToken = await findApiTokenByHash(tokenHash);
    if (!apiToken) {
      res.status(401).json({ error: "Invalid API token" });
      return;
    }

    const owner = await findUserById(apiToken.created_by);
    if (!owner || owner.is_active === 0) {
      res.status(401).json({ error: "Token owner is inactive or missing" });
      return;
    }

    await touchApiTokenLastUsed(apiToken.id);
    req.principal = {
      id: owner.id,
      username: owner.username,
      role: apiToken.role,
      authType: "api_token",
      tokenId: apiToken.id,
    };
    next();
  } catch (error) {
    res.status(401).json({
      error: "Unauthorized",
      details: error instanceof Error ? error.message : String(error),
    });
  }
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
