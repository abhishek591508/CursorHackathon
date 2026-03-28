import { Router } from 'express';
import type { Env } from '../config/env.js';
import type { RedisClient } from '../db/redis.js';
import type { AuthMiddlewares } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { createApifyController } from '../controllers/apify.controller.js';
import { relatedWebBodySchema } from '../validators/relatedWeb.validator.js';

export function createApifyRouter(
  auth: AuthMiddlewares,
  redis: RedisClient,
  env: Env,
) {
  const router = Router();
  const c = createApifyController(env, redis);

  router.post(
    '/apify/related-web',
    auth.requireAuth,
    validateBody(relatedWebBodySchema),
    c.relatedWeb,
  );

  return router;
}
