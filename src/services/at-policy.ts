export function normalizeAtCommand(command: string): string {
  return command.trim().replace(/\s+/g, "").toUpperCase();
}

export function isUserCommandAllowed(
  command: string,
  allowedPatterns: string[]
): boolean {
  const normalized = normalizeAtCommand(command);

  return allowedPatterns.some((pattern) => {
    const rule = normalizeAtCommand(pattern);
    if (rule.endsWith("*")) {
      const prefix = rule.slice(0, -1);
      return normalized.startsWith(prefix);
    }
    return normalized === rule;
  });
}
