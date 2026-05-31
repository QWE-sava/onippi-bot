type Level = "INFO" | "WARN" | "ERROR";

function write(level: Level, scope: string, message: string, details?: unknown) {
  const prefix = `[${scope}] ${message}`;
  if (details === undefined) {
    console.log(prefix);
    return;
  }

  const payload = typeof details === "string" ? details : JSON.stringify(details);
  const line = `${prefix} ${payload}`;
  if (level === "ERROR") {
    console.error(line);
    return;
  }
  if (level === "WARN") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info(scope: string, message: string, details?: unknown) {
    write("INFO", scope, message, details);
  },
  warn(scope: string, message: string, details?: unknown) {
    write("WARN", scope, message, details);
  },
  error(scope: string, message: string, details?: unknown) {
    write("ERROR", scope, message, details);
  }
};
