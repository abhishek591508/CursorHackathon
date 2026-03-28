import { createRequire } from 'node:module';
import pino from 'pino';
import type { Env } from '../config/env.js';

const require = createRequire(import.meta.url);

const redact = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'password',
    'passwordHash',
  ],
  remove: true,
};

function isPinoPrettyAvailable(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

/**
 * Pretty logs only in development when `pino-pretty` is installed.
 * Production Docker (`npm ci --omit=dev`) omits devDependencies — use plain JSON logs.
 */
export function createLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): pino.Logger {
  const base = {
    level: env.LOG_LEVEL,
    redact,
    base: { env: env.NODE_ENV },
  };

  if (env.NODE_ENV === 'development' && isPinoPrettyAvailable()) {
    return pino({
      ...base,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
    });
  }

  return pino(base);
}
