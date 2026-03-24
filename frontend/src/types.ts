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
  actor_user_id?: number | null;
  actor_token_id?: number | null;
  actor_username: string;
  actor_role: Role;
  command: string;
  response?: string | null;
  status: "ok" | "error" | "blocked";
  error?: string | null;
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

export interface ModemLeaseStatus {
  active: boolean;
  ownerUsername: string | null;
  ownerRole: Role | null;
  expiresAt: string | null;
  timeoutMs: number | null;
}

export interface ModemStatus {
  connected: boolean;
  path: string;
  baudRate: number;
  lastError: string | null;
  ser2net: {
    host: string;
    port: number;
    clients: number;
  };
  lease: ModemLeaseStatus;
}
