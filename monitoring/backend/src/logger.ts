/**
 * Lehký structured logger bez externí závislosti.
 *
 * V produkci (NODE_ENV=production) vypisuje JSON na řádek – snadno se přečte
 * Promtailem, Vectorem, Loki, CloudWatch Insights atd.
 * V dev/test režimu vypisuje barevný human-readable formát.
 *
 * API kopíruje pino: log.info(msg, meta?), log.error(msg, meta?) atd.
 * Pro production-grade workload (vysoká zátěž, alerting) zvážit nahrazení
 * skutečným pino/winston – tento wrapper pokrývá běžné case.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const JSON_OUTPUT = process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json';

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const ts = new Date().toISOString();
  if (JSON_OUTPUT) {
    const line = { ts, level, msg, ...(meta ?? {}) };
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : console.log)(JSON.stringify(line));
  } else {
    const tag = level.toUpperCase().padEnd(5);
    const extras = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : console.log)(`${ts} ${tag} ${msg}${extras}`);
  }
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
