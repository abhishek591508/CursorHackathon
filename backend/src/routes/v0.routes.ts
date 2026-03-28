import { Router } from 'express';
import type { Env } from '../config/env.js';
import type { RedisClient } from '../db/redis.js';
import type { AuthMiddlewares } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { createV0Controller } from '../controllers/v0.controller.js';
import { v0SketchBodySchema } from '../validators/v0.validator.js';

export function createV0Router(
  auth: AuthMiddlewares,
  redis: RedisClient,
  env: Env,
) {
  const router = Router();
  const c = createV0Controller(env, redis);

  router.post(
    '/v0/ui-sketch',
    auth.requireAuth,
    validateBody(v0SketchBodySchema),
    c.sketch,
  );

  return router;
}
