import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import { config } from "./config.js";
import { commandLogEvents } from "./log-events.js";
import { hashPassword, randomToken } from "./security.js";
import { Role } from "./types.js";

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  is_active: number;
  must_change_password: number;
  created_at: string;
}

interface ApiTokenRow {
  id: number;
  name: string;
  token_hash: string;
  role: Role;
  created_by: number;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

let dbPromise: Promise<Database> | null = null;

async function migrate(db: Database): Promise<void> {
  await db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      revoked_at TEXT DEFAULT NULL,
      last_used_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS command_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id),
      actor_token_id INTEGER REFERENCES api_tokens(id),
      actor_username TEXT NOT NULL,
      actor_role TEXT NOT NULL CHECK(actor_role IN ('admin', 'user')),
      command TEXT NOT NULL,
      response TEXT,
      status TEXT NOT NULL CHECK(status IN ('ok', 'error', 'blocked')),
      error TEXT,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const userColumns = await db.all<Array<{ name: string }>>(
    "PRAGMA table_info(users)"
  );
  const hasMustChangePassword = userColumns.some(
    (column) => column.name === "must_change_password"
  );
  if (!hasMustChangePassword) {
    await db.exec(
      "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"
    );
  }
}

async function bootstrapAdmin(db: Database): Promise<void> {
  const existingAdmin = await db.get<UserRow>(
    "SELECT * FROM users WHERE role = 'admin' LIMIT 1"
  );
  if (existingAdmin) {
    return;
  }

  const bootstrapPassword =
    config.adminBootstrapPassword ?? randomToken(18);
  const passwordHash = await hashPassword(bootstrapPassword);
  await db.run(
    "INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, 'admin', 1)",
    config.adminBootstrapUsername,
    passwordHash
  );

  // eslint-disable-next-line no-console
  console.log(
    `[bootstrap] admin user "${config.adminBootstrapUsername}" created with temporary password: ${bootstrapPassword}`
  );
  // eslint-disable-next-line no-console
  console.log("[bootstrap] password change is required on first login.");
}

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    const dbDir = path.dirname(config.dbPath);
    fs.mkdirSync(dbDir, { recursive: true });

    dbPromise = open({
      filename: config.dbPath,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await migrate(db);
      await bootstrapAdmin(db);
      return db;
    });
  }
  return dbPromise;
}

export async function findUserByUsername(
  username: string
): Promise<UserRow | undefined> {
  const db = await getDb();
  return db.get<UserRow>("SELECT * FROM users WHERE username = ?", username);
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  const db = await getDb();
  return db.get<UserRow>("SELECT * FROM users WHERE id = ?", id);
}

export async function listUsers(): Promise<
  Array<Pick<UserRow, "id" | "username" | "role" | "is_active" | "created_at">>
> {
  const db = await getDb();
  return db.all(
    "SELECT id, username, role, is_active, created_at FROM users ORDER BY created_at DESC"
  );
}

export async function createUser(input: {
  username: string;
  passwordHash: string;
  role: Role;
  mustChangePassword?: boolean;
}): Promise<number> {
  const db = await getDb();
  const res = await db.run(
    "INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, ?)",
    input.username,
    input.passwordHash,
    input.role,
    input.mustChangePassword ? 1 : 0
  );
  return res.lastID as number;
}

export async function updateUserPassword(input: {
  userId: number;
  passwordHash: string;
}): Promise<void> {
  const db = await getDb();
  await db.run(
    "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
    input.passwordHash,
    input.userId
  );
}

export async function createApiToken(input: {
  name: string;
  tokenHash: string;
  role: Role;
  createdBy: number;
}): Promise<number> {
  const db = await getDb();
  const res = await db.run(
    "INSERT INTO api_tokens (name, token_hash, role, created_by) VALUES (?, ?, ?, ?)",
    input.name,
    input.tokenHash,
    input.role,
    input.createdBy
  );
  return res.lastID as number;
}

export async function findApiTokenByHash(
  tokenHash: string
): Promise<ApiTokenRow | undefined> {
  const db = await getDb();
  return db.get<ApiTokenRow>(
    "SELECT * FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL",
    tokenHash
  );
}

export async function touchApiTokenLastUsed(id: number): Promise<void> {
  const db = await getDb();
  await db.run(
    "UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
    id
  );
}

export async function revokeApiToken(id: number): Promise<void> {
  const db = await getDb();
  await db.run(
    "UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL",
    id
  );
}

export async function listApiTokens(): Promise<
  Array<
    Pick<
      ApiTokenRow,
      "id" | "name" | "role" | "created_by" | "created_at" | "last_used_at" | "revoked_at"
    >
  >
> {
  const db = await getDb();
  return db.all(
    `SELECT id, name, role, created_by, created_at, last_used_at, revoked_at
     FROM api_tokens
     ORDER BY created_at DESC`
  );
}

export async function writeCommandLog(input: {
  actorUserId: number | null;
  actorTokenId: number | null;
  actorUsername: string;
  actorRole: Role;
  command: string;
  response?: string;
  status: "ok" | "error" | "blocked";
  error?: string;
  durationMs?: number;
}): Promise<void> {
  const db = await getDb();
  const res = await db.run(
    `INSERT INTO command_logs
      (actor_user_id, actor_token_id, actor_username, actor_role, command, response, status, error, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.actorUserId,
    input.actorTokenId,
    input.actorUsername,
    input.actorRole,
    input.command,
    input.response ?? null,
    input.status,
    input.error ?? null,
    input.durationMs ?? null
  );

  commandLogEvents.emit({
    id: res.lastID as number,
    actor_user_id: input.actorUserId,
    actor_token_id: input.actorTokenId,
    actor_username: input.actorUsername,
    actor_role: input.actorRole,
    command: input.command,
    response: input.response ?? null,
    status: input.status,
    error: input.error ?? null,
    duration_ms: input.durationMs ?? null,
    created_at: new Date().toISOString(),
  });
}

export async function listCommandLogs(input: {
  limit: number;
  actorUserId?: number;
}): Promise<
  Array<{
    id: number;
    actor_user_id: number | null;
    actor_token_id: number | null;
    actor_username: string;
    actor_role: Role;
    command: string;
    response: string | null;
    status: "ok" | "error" | "blocked";
    error: string | null;
    duration_ms: number | null;
    created_at: string;
  }>
> {
  const db = await getDb();
  if (typeof input.actorUserId === "number") {
    return db.all(
      `SELECT * FROM command_logs WHERE actor_user_id = ?
       ORDER BY id DESC LIMIT ?`,
      input.actorUserId,
      input.limit
    );
  }
  return db.all(
    "SELECT * FROM command_logs ORDER BY id DESC LIMIT ?",
    input.limit
  );
}

export async function cleanupOldCommandLogs(
  retentionDays: number
): Promise<number> {
  const db = await getDb();
  const res = await db.run(
    `DELETE FROM command_logs
     WHERE datetime(created_at) < datetime('now', ?)`,
    `-${retentionDays} days`
  );
  return (res.changes as number) ?? 0;
}
