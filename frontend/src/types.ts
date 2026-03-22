export type Role = "admin" | "user";

export interface Principal {
  id: number;
  username: string;
  role: Role;
  authType: "jwt" | "api_token";
  mustChangePassword: boolean;
}

export interface CommandLog {
  id: number;
  actor_username: string;
  actor_role: Role;
  command: string;
  status: "ok" | "error" | "blocked";
  duration_ms: number | null;
  created_at: string;
}

export interface ApiToken {
  id: number;
  name: string;
  role: Role;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
