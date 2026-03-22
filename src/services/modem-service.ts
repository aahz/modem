import { SerialPort } from "serialport";
import { config } from "../config.js";
import { SendAtResult } from "../types.js";

export class ModemService {
  private port: SerialPort | null = null;
  private queue: Promise<void> = Promise.resolve();
  private lastError: string | null = null;
  private interactiveSessions = 0;

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
      this.lastError = null;
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
  } {
    return {
      connected: Boolean(this.port?.isOpen),
      path: config.serialPath,
      baudRate: config.baudRate,
      lastError: this.lastError,
    };
  }

  async sendCommand(command: string, timeoutMs = 5000): Promise<SendAtResult> {
    if (this.interactiveSessions > 0) {
      throw new Error("Interactive terminal session is active");
    }
    const atMode = await this.ensureAtCommandMode();
    if (!atMode.ok) {
      throw new Error(atMode.message);
    }
    return this.enqueue(() => this.executeCommand(command, timeoutMs));
  }

  async openInteractiveSession(handlers: {
    onData: (chunk: string) => void;
    onSystem: (message: string) => void;
  }): Promise<{
    write: (chunk: string) => Promise<void>;
    close: () => void;
  }> {
    await this.ensureConnected();
    const port = this.port!;

    this.interactiveSessions += 1;
    handlers.onSystem("interactive session opened");

    const onData = (chunk: Buffer): void => {
      handlers.onData(chunk.toString("latin1"));
    };
    const onError = (error: Error): void => {
      handlers.onSystem(`serial error: ${error.message}`);
    };

    port.on("data", onData);
    port.on("error", onError);

    let closed = false;
    const close = (): void => {
      if (closed) {
        return;
      }
      closed = true;
      this.interactiveSessions = Math.max(0, this.interactiveSessions - 1);
      port.off("data", onData);
      port.off("error", onError);
      handlers.onSystem("interactive session closed");
    };

    return {
      write: async (chunk: string) => {
        await new Promise<void>((resolve, reject) => {
          port.write(chunk, (error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
      },
      close,
    };
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
}

export const modemService = new ModemService();
