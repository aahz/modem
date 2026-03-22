import { AuthPrincipal } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      principal?: AuthPrincipal;
    }
  }
}

export {};
