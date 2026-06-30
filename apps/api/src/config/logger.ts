import { env } from './env';

const isProduction = env.NODE_ENV === 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function formatLog(level: LogLevel, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] ${level.toUpperCase()}`;
  if (data instanceof Error) {
    return `${prefix} ${message} — ${data.message}`;
  }
  if (data !== undefined) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const minLevel = isProduction ? LEVELS.info : LEVELS.debug;
  if (LEVELS[level] < minLevel) return;
  const line = formatLog(level, message, data);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, data),
  info: (msg: string, data?: unknown) => log('info', msg, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, data),
  error: (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : 'Error';
    const data = args.length > 1 ? args[1] : (typeof args[0] !== 'string' ? args[0] : undefined);
    log('error', msg, data instanceof Error ? data : undefined);
  },
};
