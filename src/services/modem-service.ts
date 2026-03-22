import { SerialPort } from "serialport";
import { config } from "../config.js";
import { SendAtResult } from "../types.js";

export class ModemService {
  private port: SerialPort | null = null;
  private queue: Promise<void> = Promise.resolve();
  private lastError: string | null = null;

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
    return this.enqueue(() => this.executeCommand(command, timeoutMs));
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

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`AT command timeout (${timeoutMs}ms)`));
      }, timeoutMs);

      const finalizeIfTerminal = (line: string): void => {
        const normalized = line.trim().toUpperCase();
        if (normalized === "OK" || normalized === "ERROR") {
          cleanup();
          resolve();
        }
      };

      const onData = (chunk: Buffer): void => {
        rawBuffer += chunk.toString("utf8");
        const split = rawBuffer.split(/\r?\n/);
        rawBuffer = split.pop() ?? "";
        for (const rawLine of split) {
          const line = rawLine.trim();
          if (!line) {
            continue;
          }
          lines.push(line);
          finalizeIfTerminal(line);
        }
      };

      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };

      const cleanup = (): void => {
        clearTimeout(timeout);
        port.off("data", onData);
        port.off("error", onError);
      };

      port.on("data", onData);
      port.on("error", onError);

      port.write(`${trimmed}\r`, (error) => {
        if (error) {
          cleanup();
          reject(error);
        }
      });
    });

    return {
      response: lines.join("\n"),
      durationMs: Date.now() - startedAt,
    };
  }
}

export const modemService = new ModemService();
