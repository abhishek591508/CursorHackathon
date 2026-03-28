import { Router } from 'express';
import type { Env } from '../config/env.js';
import type { RedisClient } from '../db/redis.js';
import type { AuthMiddlewares } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { createExaController } from '../controllers/exa.controller.js';
import { relatedWebBodySchema } from '../validators/relatedWeb.validator.js';

export function createExaRouter(
  auth: AuthMiddlewares,
  redis: RedisClient,
  env: Env,
) {
  const router = Router();
  const c = createExaController(env, redis);

  router.post(
    '/exa/related-web',
    auth.requireAuth,
    validateBody(relatedWebBodySchema),
    c.relatedWeb,
  );

  return router;
}
