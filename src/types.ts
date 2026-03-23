export type Role = "admin" | "user";

export interface AuthPrincipal {
  id: number;
  username: string;
  role: Role;
  authType: "jwt" | "api_token";
  tokenId?: number;
  mustChangePassword: boolean;
}

export interface SendAtResult {
  response: string;
  durationMs: number;
}
