import { makeAutoObservable, runInAction } from "mobx";
import { api } from "../lib/api";
import { ApiToken, CommandLog, Principal, Role } from "../types";

export class AppStore {
  token = localStorage.getItem("jwt") ?? "";
  user: Principal | null = null;
  username = "root";
  password = "";
  busy = false;
  error: string | null = null;

  currentPassword = "";
  newPassword = "";
  atCommand = "AT+CSQ";
  atTimeout = "5000";
  atResponse = "";

  modemStatus: {
    connected: boolean;
    path: string;
    baudRate: number;
    lastError: string | null;
  } | null = null;
  atModeReady: boolean | null = null;

  logs: CommandLog[] = [];
  logLimit = "100";
  tokens: ApiToken[] = [];
  newTokenName = "integration";
  newTokenRole: Role = "user";
  lastIssuedToken = "";

  private logsEventSource: EventSource | null = null;

  constructor() {
    makeAutoObservable(this, {
      logsEventSource: false,
    }, { autoBind: true });
  }

  get securityLocked(): boolean {
    return Boolean(this.user?.mustChangePassword);
  }

  setUsername(value: string): void { this.username = value; }
  setPassword(value: string): void { this.password = value; }
  setCurrentPassword(value: string): void { this.currentPassword = value; }
  setNewPassword(value: string): void { this.newPassword = value; }
  setAtCommand(value: string): void { this.atCommand = value; }
  setAtTimeout(value: string): void { this.atTimeout = value; }
  setAtResponse(value: string): void { this.atResponse = value; }
  setLogLimit(value: string): void { this.logLimit = value; }
  setNewTokenName(value: string): void { this.newTokenName = value; }
  setNewTokenRole(value: Role): void { this.newTokenRole = value; }
  setLastIssuedToken(value: string): void { this.lastIssuedToken = value; }

  async loadMe(activeToken: string): Promise<void> {
    if (!activeToken) {
      runInAction(() => { this.user = null; });
      return;
    }
    const me = await api<{ user: Principal }>("/auth/me", activeToken);
    runInAction(() => { this.user = me.user; });
  }

  async loadLogs(activeToken: string): Promise<void> {
    const res = await api<{ items: CommandLog[] }>(
      `/logs?limit=${encodeURIComponent(this.logLimit)}`,
      activeToken
    );
    runInAction(() => { this.logs = res.items; });
  }

  async loadTokens(activeToken: string): Promise<void> {
    if (this.user?.role !== "admin") {
      return;
    }
    const res = await api<{ items: ApiToken[] }>("/tokens", activeToken);
    runInAction(() => { this.tokens = res.items; });
  }

  async refreshModemStatus(activeToken: string): Promise<void> {
    const status = await api<{
      connected: boolean;
      path: string;
      baudRate: number;
      lastError: string | null;
    }>("/modem/status", activeToken);
    runInAction(() => { this.modemStatus = status; });
  }

  async checkModemMode(activeToken: string): Promise<void> {
    const res = await api<{ atModeReady: boolean }>("/modem/mode", activeToken);
    runInAction(() => { this.atModeReady = res.atModeReady; });
  }

  async recoverModemMode(activeToken: string): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const res = await api<{ ok: boolean; message: string }>(
        "/modem/recover-mode",
        activeToken,
        { method: "POST" }
      );
      runInAction(() => {
        this.atModeReady = res.ok;
        this.atResponse = `${this.atResponse ? `${this.atResponse}\n\n` : ""}[mode] ${res.message}`;
      });
    } catch (e) {
      runInAction(() => { this.error = e instanceof Error ? e.message : String(e); });
    } finally {
      runInAction(() => { this.busy = false; });
    }
  }

  async handleLogin(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const res = await api<{ accessToken: string; user: Principal }>("/auth/login", "", {
        method: "POST",
        body: JSON.stringify({ username: this.username, password: this.password }),
      });
      runInAction(() => {
        this.token = res.accessToken;
        this.user = res.user;
        localStorage.setItem("jwt", res.accessToken);
      });
      if (!res.user.mustChangePassword) {
        await this.loadLogs(res.accessToken);
      }
    } catch (e) {
      runInAction(() => { this.error = e instanceof Error ? e.message : String(e); });
    } finally {
      runInAction(() => { this.busy = false; });
    }
  }

  async handleChangePassword(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const res = await api<{ accessToken: string; user: Principal }>(
        "/auth/change-password",
        this.token,
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword: this.currentPassword,
            newPassword: this.newPassword,
          }),
        }
      );
      runInAction(() => {
        this.token = res.accessToken;
        this.user = res.user;
        this.currentPassword = "";
        this.newPassword = "";
        localStorage.setItem("jwt", res.accessToken);
      });
      await this.loadDashboardData(res.accessToken);
    } catch (e) {
      runInAction(() => { this.error = e instanceof Error ? e.message : String(e); });
    } finally {
      runInAction(() => { this.busy = false; });
    }
  }

  async handleSendAt(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const res = await api<{ response: string; durationMs: number }>("/at/send", this.token, {
        method: "POST",
        body: JSON.stringify({
          command: this.atCommand,
          timeoutMs: Number(this.atTimeout || "5000"),
        }),
      });
      runInAction(() => {
        this.atResponse = `${res.response}\n\n${res.durationMs} ms`;
      });
    } catch (e) {
      runInAction(() => { this.error = e instanceof Error ? e.message : String(e); });
    } finally {
      runInAction(() => { this.busy = false; });
    }
  }

  async issueToken(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const res = await api<{ token: string }>("/tokens", this.token, {
        method: "POST",
        body: JSON.stringify({
          name: this.newTokenName,
          role: this.newTokenRole,
        }),
      });
      runInAction(() => { this.lastIssuedToken = res.token; });
      await this.loadTokens(this.token);
    } catch (e) {
      runInAction(() => { this.error = e instanceof Error ? e.message : String(e); });
    } finally {
      runInAction(() => { this.busy = false; });
    }
  }

  async revokeToken(id: number): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      await api<null>(`/tokens/${id}/revoke`, this.token, { method: "POST" });
      await this.loadTokens(this.token);
    } catch (e) {
      runInAction(() => { this.error = e instanceof Error ? e.message : String(e); });
    } finally {
      runInAction(() => { this.busy = false; });
    }
  }

  logout(): void {
    this.token = "";
    this.user = null;
    this.logs = [];
    this.tokens = [];
    localStorage.removeItem("jwt");
    this.stopLogsStream();
  }

  async loadDashboardData(activeToken: string): Promise<void> {
    if (!activeToken || !this.user || this.securityLocked) {
      return;
    }
    await Promise.allSettled([
      this.loadLogs(activeToken),
      this.refreshModemStatus(activeToken),
      this.checkModemMode(activeToken),
      this.user.role === "admin" ? this.loadTokens(activeToken) : Promise.resolve(),
    ]);
  }

  startLogsStream(): void {
    this.stopLogsStream();
    if (!this.token || !this.user || this.securityLocked) {
      return;
    }
    const es = new EventSource(`/api/v1/logs/stream?token=${encodeURIComponent(this.token)}`);
    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as CommandLog;
      runInAction(() => {
        this.logs = [parsed, ...this.logs].slice(0, Number(this.logLimit) || 100);
      });
    };
    es.onerror = () => {
      es.close();
      this.logsEventSource = null;
      setTimeout(() => {
        if (this.token && this.user && !this.securityLocked) {
          this.loadLogs(this.token).catch(() => undefined);
          this.startLogsStream();
        }
      }, 1000);
    };
    this.logsEventSource = es;
  }

  stopLogsStream(): void {
    if (this.logsEventSource) {
      this.logsEventSource.close();
      this.logsEventSource = null;
    }
  }
}

export const appStore = new AppStore();
