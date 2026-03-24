import { SerialPort } from "serialport";
import net, { Socket } from "net";
import { config } from "../config.js";
import { AuthPrincipal, SendAtResult } from "../types.js";

interface ModemLease {
  ownerKey: string;
  ownerUsername: string;
  ownerRole: AuthPrincipal["role"];
  expiresAtMs: number;
  timeoutMs: number;
  timer: NodeJS.Timeout;
}

export class ModemService {
  private port: SerialPort | null = null;
  private queue: Promise<void> = Promise.resolve();
  private lastError: string | null = null;
  private tcpServer: net.Server | null = null;
  private tcpClients = new Set<Socket>();
  private lease: ModemLease | null = null;

  private onSerialData = (chunk: Buffer): void => {
    if (this.lease) {
      return;
    }
    for (const client of this.tcpClients) {
      if (client.destroyed) {
        continue;
      }
      client.write(chunk);
    }
  };

  async connect(): Promise<void> {
    try {
      const port = new SerialPort({
        path: config.serialPath,
        baudRate: config.baudRate,
        autoOpen: false,
      });

      await new Promise<void>((resolve, reject) => {
        port.open((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });

      this.port = port;
      this.port.on("data", this.onSerialData);
      this.lastError = null;
      this.ensureTcpBridge();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.port = null;
    }
  }

  status(): {
    connected: boolean;
    path: string;
    baudRate: number;
    lastError: string | null;
    ser2net: {
      host: string;
      port: number;
      clients: number;
    };
    lease: {
      active: boolean;
      ownerUsername: string | null;
      ownerRole: AuthPrincipal["role"] | null;
      expiresAt: string | null;
      timeoutMs: number | null;
    };
  } {
    return {
      connected: Boolean(this.port?.isOpen),
      path: config.serialPath,
      baudRate: config.baudRate,
      lastError: this.lastError,
      ser2net: {
        host: config.ser2netHost,
        port: config.ser2netPort,
        clients: this.tcpClients.size,
      },
      lease: {
        active: Boolean(this.lease),
        ownerUsername: this.lease?.ownerUsername ?? null,
        ownerRole: this.lease?.ownerRole ?? null,
        expiresAt: this.lease
          ? new Date(this.lease.expiresAtMs).toISOString()
          : null,
        timeoutMs: this.lease?.timeoutMs ?? null,
      },
    };
  }

  async acquire(principal: AuthPrincipal, timeoutMs = config.acquireTimeoutMs): Promise<{
    acquired: boolean;
    lease: {
      ownerUsername: string;
      ownerRole: AuthPrincipal["role"];
      expiresAt: string;
      timeoutMs: number;
    } | null;
    reason?: string;
  }> {
    await this.ensureConnected();
    const ownerKey = this.ownerKey(principal);
    const activeLease = this.lease;

    if (activeLease && activeLease.ownerKey !== ownerKey) {
      return {
        acquired: false,
        lease: {
          ownerUsername: activeLease.ownerUsername,
          ownerRole: activeLease.ownerRole,
          expiresAt: new Date(activeLease.expiresAtMs).toISOString(),
          timeoutMs: activeLease.timeoutMs,
        },
        reason: `Modem already acquired by ${activeLease.ownerUsername}`,
      };
    }

    if (activeLease && activeLease.ownerKey === ownerKey) {
      this.resetLeaseTimer(activeLease, timeoutMs);
      return {
        acquired: true,
        lease: {
          ownerUsername: activeLease.ownerUsername,
          ownerRole: activeLease.ownerRole,
          expiresAt: new Date(activeLease.expiresAtMs).toISOString(),
          timeoutMs: activeLease.timeoutMs,
        },
      };
    }

    const lease: ModemLease = {
      ownerKey,
      ownerUsername: principal.username,
      ownerRole: principal.role,
      expiresAtMs: 0,
      timeoutMs,
      timer: setTimeout(() => undefined, timeoutMs),
    };
    this.lease = lease;
    this.resetLeaseTimer(lease, timeoutMs);
    this.disconnectAllTcpClients();

    return {
      acquired: true,
      lease: {
        ownerUsername: lease.ownerUsername,
        ownerRole: lease.ownerRole,
        expiresAt: new Date(lease.expiresAtMs).toISOString(),
        timeoutMs: lease.timeoutMs,
      },
    };
  }

  release(principal: AuthPrincipal): {
    released: boolean;
    reason?: string;
  } {
    const activeLease = this.lease;
    if (!activeLease) {
      return { released: true };
    }
    if (principal.role !== "admin" && activeLease.ownerKey !== this.ownerKey(principal)) {
      return { released: false, reason: "Modem is acquired by another session" };
    }
    this.clearLease();
    return { released: true };
  }

  touchLease(principal: AuthPrincipal): void {
    const activeLease = this.lease;
    if (!activeLease) {
      throw new Error("Modem is currently in network mode. Call /acquire first.");
    }
    if (activeLease.ownerKey !== this.ownerKey(principal)) {
      throw new Error("Modem is acquired by another session.");
    }
    this.resetLeaseTimer(activeLease, activeLease.timeoutMs);
  }

  async sendCommand(command: string, timeoutMs = 5000): Promise<SendAtResult> {
    const atMode = await this.ensureAtCommandMode();
    if (!atMode.ok) {
      throw new Error(atMode.message);
    }
    return this.enqueue(() => this.executeCommand(command, timeoutMs));
  }

  async ensureAtCommandMode(): Promise<{
    ok: boolean;
    message: string;
  }> {
    await this.ensureConnected();

    const alreadyInAtMode = await this.enqueue(async () =>
      this.probeAtMode(1400)
    );
    if (alreadyInAtMode) {
      return { ok: true, message: "AT command mode is ready" };
    }

    await this.sleep(1100);
    await this.writeRaw("+++");
    await this.sleep(1100);

    const switchedToAtMode = await this.enqueue(async () =>
      this.probeAtMode(1600)
    );
    if (switchedToAtMode) {
      await this.bestEffortInitSequence();
      return {
        ok: true,
        message: "Switched modem to AT command mode via +++",
      };
    }

    await this.bestEffortInitSequence();
    const recoveredByInitSequence = await this.enqueue(async () =>
      this.probeAtMode(1800)
    );
    if (recoveredByInitSequence) {
      return {
        ok: true,
        message:
          "Recovered AT command mode via modem init sequence (ATH/ATZ/FCLASS)",
      };
    }

    return {
      ok: false,
      message:
        "Could not switch modem to AT mode; modem may still be in binary data mode",
    };
  }

  async checkAtCommandMode(): Promise<boolean> {
    await this.ensureConnected();
    return this.enqueue(async () => this.probeAtMode(1200));
  }

  async recoverAtCommandMode(): Promise<{
    ok: boolean;
    message: string;
  }> {
    return this.ensureAtCommandMode();
  }

  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async executeCommand(
    command: string,
    timeoutMs: number
  ): Promise<SendAtResult> {
    const port = this.port;
    if (!port || !port.isOpen) {
      throw new Error("Modem serial port is not connected");
    }

    const trimmed = command.trim();
    if (!trimmed) {
      throw new Error("AT command is empty");
    }

    const startedAt = Date.now();
    let rawBuffer = "";
    const lines: string[] = [];
    let hasData = false;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`AT command timeout (${timeoutMs}ms)`));
      }, timeoutMs);
      let idleTimer: NodeJS.Timeout | null = null;

      const finalizeIfTerminal = (line: string): void => {
        const normalized = line.trim().toUpperCase();
        if (normalized === "OK" || normalized === "ERROR") {
          cleanup();
          resolve();
        }
      };

      const scheduleIdleResolve = (): void => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
        idleTimer = setTimeout(() => {
          if (hasData) {
            cleanup();
            resolve();
          }
        }, 800);
      };

      const flushChunkLines = (): void => {
        const split = rawBuffer.split(/\r\n|\n|\r/);
        rawBuffer = split.pop() ?? "";
        for (const rawLine of split) {
          const line = rawLine.trim();
          if (!line) {
            continue;
          }
          hasData = true;
          lines.push(line);
          finalizeIfTerminal(line);
        }
      };

      const onData = (chunk: Buffer): void => {
        rawBuffer += chunk.toString("utf8");
        flushChunkLines();
        scheduleIdleResolve();
      };

      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };

      const cleanup = (): void => {
        clearTimeout(timeout);
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        port.off("data", onData);
        port.off("error", onError);
      };

      port.on("data", onData);
      port.on("error", onError);

      port.write(`${trimmed}\r`, (error) => {
        if (error) {
          cleanup();
          reject(error);
          return;
        }
        port.drain((drainError) => {
          if (drainError) {
            cleanup();
            reject(drainError);
          }
        });
      });
    });

    return {
      response: lines.join("\n"),
      durationMs: Date.now() - startedAt,
    };
  }

  private async ensureConnected(): Promise<void> {
    if (this.port?.isOpen) {
      return;
    }
    await this.connect();
    if (!this.port?.isOpen) {
      throw new Error("Modem serial port is not connected");
    }
  }

  private async probeAtMode(timeoutMs: number): Promise<boolean> {
    try {
      const res = await this.executeCommand("AT", timeoutMs);
      return /\bOK\b/i.test(res.response);
    } catch {
      return false;
    }
  }

  private async bestEffortInitSequence(): Promise<void> {
    await this.enqueue(async () => {
      await this.bestEffortCommand("ATH", 1800);
      await this.bestEffortCommand("ATZ", 2500);
      await this.bestEffortCommand("AT+FCLASS=0", 1800);
      await this.bestEffortCommand("ATE1", 1200);
    });
  }

  private async bestEffortCommand(
    command: string,
    timeoutMs: number
  ): Promise<void> {
    try {
      await this.executeCommand(command, timeoutMs);
    } catch {
      // ignore best-effort init errors
    }
  }

  private async writeRaw(chunk: string): Promise<void> {
    const port = this.port;
    if (!port || !port.isOpen) {
      throw new Error("Modem serial port is not connected");
    }
    await new Promise<void>((resolve, reject) => {
      port.write(chunk, (error) => {
        if (error) {
          reject(error);
          return;
        }
        port.drain((drainError) => {
          if (drainError) {
            reject(drainError);
            return;
          }
          resolve();
        });
      });
    });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private ensureTcpBridge(): void {
    if (this.tcpServer) {
      return;
    }

    const server = net.createServer((socket) => {
      if (!this.port?.isOpen) {
        socket.end();
        return;
      }
      if (this.lease) {
        socket.end();
        return;
      }

      this.tcpClients.add(socket);
      socket.on("close", () => {
        this.tcpClients.delete(socket);
      });
      socket.on("error", () => {
        this.tcpClients.delete(socket);
      });
      socket.on("data", (chunk: Buffer) => {
        if (!this.port?.isOpen || this.lease) {
          socket.end();
          return;
        }
        this.port.write(chunk, (error) => {
          if (error) {
            socket.end();
            return;
          }
          this.port?.drain(() => undefined);
        });
      });
    });

    server.on("error", (error) => {
      this.lastError = error.message;
    });
    server.listen(config.ser2netPort, config.ser2netHost);
    this.tcpServer = server;
  }

  private disconnectAllTcpClients(): void {
    for (const socket of this.tcpClients) {
      socket.destroy();
    }
    this.tcpClients.clear();
  }

  private ownerKey(principal: AuthPrincipal): string {
    if (principal.authType === "api_token") {
      return `token:${principal.tokenId ?? principal.id}`;
    }
    return `jwt:${principal.id}`;
  }

  private clearLease(): void {
    if (!this.lease) {
      return;
    }
    clearTimeout(this.lease.timer);
    this.lease = null;
  }

  private resetLeaseTimer(lease: ModemLease, timeoutMs: number): void {
    clearTimeout(lease.timer);
    lease.timeoutMs = timeoutMs;
    lease.expiresAtMs = Date.now() + timeoutMs;
    lease.timer = setTimeout(() => {
      this.clearLease();
    }, timeoutMs);
    lease.timer.unref();
  }
}

export const modemService = new ModemService();
