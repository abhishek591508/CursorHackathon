import type { Env } from '../config/env.js';
import type { RedisClient } from '../db/redis.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { defaultApifyActorId, runGoogleSearchViaApify } from '../services/apifySearch.service.js';
import { buildQueryFromPost } from '../services/postContextQuery.js';
import { consumeSearchToolSlot } from '../services/searchToolRateLimit.js';
import { getPostById } from '../services/post.service.js';
import type { RelatedWebBody } from '../validators/relatedWeb.validator.js';

export function createApifyController(env: Env, redis: RedisClient) {
  return {
    relatedWeb: asyncHandler(async (req, res) => {
      if (!env.APIFY_TOKEN?.trim()) {
        throw new AppError(
          503,
          'Web context search is not configured. Set APIFY_TOKEN on the API server.',
        );
      }
      const userId = req.auth?.userId;
      if (!userId) {
        throw new AppError(401, 'Sign in to fetch related web results (Apify)');
      }

      await consumeSearchToolSlot(redis, userId, 'apify', {
        redisMax: 15,
        memoryMax: 12,
        message:
          'Apify search hourly limit reached for your account. Try again later.',
      });

      const body = req.body as RelatedWebBody;
      let query = body.q?.trim() ?? '';

      if (body.postId?.trim()) {
        const post = await getPostById(body.postId.trim());
        const fromPost = buildQueryFromPost({
          title: post.title,
          issueTags: post.issueTags,
          districtKey: post.districtKey,
          villageLabel: post.villageLabel,
          placeLabel: post.placeLabel,
        });
        if (!query) {
          query = fromPost;
        } else {
          query = `${query} ${fromPost}`.trim().slice(0, 220);
        }
      }

      if (query.length < 4) {
        throw new AppError(400, 'Could not build a search query; add a manual q or use a richer post.');
      }

      const actorId = defaultApifyActorId(env.APIFY_GOOGLE_SEARCH_ACTOR_ID);
      const results = await runGoogleSearchViaApify(
        env.APIFY_TOKEN.trim(),
        actorId,
        query,
      );

      res.json({
        query,
        source: 'apify',
        actorId,
        disclaimer:
          'Third-party web results for context only — not verified by CivicPulse. Follow each site’s terms.',
        results,
      });
    }),
  };
}
