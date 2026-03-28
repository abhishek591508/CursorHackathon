import type { RedisClient } from '../db/redis.js';
import { AppError } from '../utils/AppError.js';

const MEMORY_WINDOW_MS = 60 * 60 * 1000;
const memoryHits = new Map<string, number[]>();

function memoryKey(bucket: string, userId: string): string {
  return `${bucket}:${userId}`;
}

/**
 * Per-user hourly cap for third-party search/generation APIs (Apify, Exa, v0).
 */
export async function consumeSearchToolSlot(
  redis: RedisClient,
  userId: string,
  bucket: string,
  opts: { redisMax: number; memoryMax: number; message: string },
): Promise<void> {
  if (redis) {
    const k = `${bucket}:rl:${userId}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, 3600);
    if (n > opts.redisMax) {
      throw new AppError(429, opts.message);
    }
    return;
  }
  const now = Date.now();
  const mk = memoryKey(bucket, userId);
  let arr = memoryHits.get(mk) ?? [];
  arr = arr.filter((t) => now - t < MEMORY_WINDOW_MS);
  if (arr.length >= opts.memoryMax) {
    throw new AppError(429, opts.message);
  }
  arr.push(now);
  memoryHits.set(mk, arr);
}
