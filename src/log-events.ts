import { EventEmitter } from "events";
import { Role } from "./types.js";

export interface CommandLogEvent {
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
}

const emitter = new EventEmitter();

export const commandLogEvents = {
  on(listener: (event: CommandLogEvent) => void): void {
    emitter.on("command-log", listener);
  },
  off(listener: (event: CommandLogEvent) => void): void {
    emitter.off("command-log", listener);
  },
  emit(event: CommandLogEvent): void {
    emitter.emit("command-log", event);
  },
};
