import { NextFunction, Request, Response } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function createRateLimit(options: {
  windowMs: number;
  max: number;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key =
      req.principal?.id?.toString() ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.max) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfterSec.toString());
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }

    existing.count += 1;
    next();
  };
}
