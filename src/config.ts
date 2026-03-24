import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  DB_PATH: z.string().default("./data/modem.sqlite"),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("12h"),
  SERIAL_PATH: z.string().default("/dev/ttyUSB0"),
  BAUD_RATE: z.coerce.number().int().positive().default(115200),
  SER2NET_HOST: z.string().default("0.0.0.0"),
  SER2NET_PORT: z.coerce.number().int().positive().default(2000),
  ACQUIRE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  USER_ALLOWED_COMMANDS: z
    .string()
    .default("AT,ATI,AT+CSQ,AT+CREG?,AT+COPS?,AT+CGATT?"),
  ADMIN_BOOTSTRAP_USERNAME: z.string().default("admin"),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(6).optional(),
});

const env = envSchema.parse(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  dbPath: env.DB_PATH,
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  serialPath: env.SERIAL_PATH,
  baudRate: env.BAUD_RATE,
  ser2netHost: env.SER2NET_HOST,
  ser2netPort: env.SER2NET_PORT,
  acquireTimeoutMs: env.ACQUIRE_TIMEOUT_MS,
  logRetentionDays: env.LOG_RETENTION_DAYS,
  userAllowedCommands: env.USER_ALLOWED_COMMANDS.split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean),
  adminBootstrapUsername: env.ADMIN_BOOTSTRAP_USERNAME,
  adminBootstrapPassword: env.ADMIN_BOOTSTRAP_PASSWORD,
};
