export type LogLevel = "debug" | "info" | "warn" | "error";

function timestamp(): string {
  return new Date().toISOString();
}

export function log(level: LogLevel, message: string, details?: Record<string, unknown>): void {
  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
  if (details && Object.keys(details).length > 0) {
    console.log(`${prefix} ${message}`, details);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  debug: (message: string, details?: Record<string, unknown>) => log("debug", message, details),
  info: (message: string, details?: Record<string, unknown>) => log("info", message, details),
  warn: (message: string, details?: Record<string, unknown>) => log("warn", message, details),
  error: (message: string, details?: Record<string, unknown>) => log("error", message, details),
};
