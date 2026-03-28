import type { Env } from '../config/env.js';
import type { RedisClient } from '../db/redis.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { consumeSearchToolSlot } from '../services/searchToolRateLimit.js';
import { runV0UiSketch } from '../services/v0Sketch.service.js';
import type { V0SketchBody } from '../validators/v0.validator.js';

export function createV0Controller(env: Env, redis: RedisClient) {
  return {
    sketch: asyncHandler(async (req, res) => {
      if (!env.V0_API_KEY?.trim()) {
        throw new AppError(
          503,
          'v0 is not configured. Set V0_API_KEY on the API server (v0.dev → Settings → API keys).',
        );
      }
      const userId = req.auth?.userId;
      if (!userId) {
        throw new AppError(401, 'Sign in to use v0 UI sketch');
      }

      await consumeSearchToolSlot(redis, userId, 'v0', {
        redisMax: 5,
        memoryMax: 3,
        message:
          'v0 sketch hourly limit reached (expensive API). Try again later.',
      });

      const body = req.body as V0SketchBody;
      const out = await runV0UiSketch(env.V0_API_KEY.trim(), body.prompt);

      res.json({
        source: 'v0',
        ...out,
        hint: 'Open webUrl in the browser to iterate; copy files into web/src manually.',
      });
    }),
  };
}
