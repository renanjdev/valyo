const MAX_LINES = 50;

export interface LogEntry {
  time: string;
  level: string;
  msg: string;
}

const buffer: LogEntry[] = [];

export function pushLog(line: string): void {
  try {
    const parsed = JSON.parse(line) as { time?: number; level?: number; msg?: string };
    const levelMap: Record<number, string> = { 10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL' };
    buffer.push({
      time: parsed.time ? new Date(parsed.time).toISOString() : new Date().toISOString(),
      level: levelMap[parsed.level ?? 30] ?? 'INFO',
      msg: parsed.msg ?? line,
    });
    if (buffer.length > MAX_LINES) buffer.shift();
  } catch {
    buffer.push({ time: new Date().toISOString(), level: 'INFO', msg: line.trim() });
    if (buffer.length > MAX_LINES) buffer.shift();
  }
}

export function getLogs(): LogEntry[] {
  return [...buffer];
}
