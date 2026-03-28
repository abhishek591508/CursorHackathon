import type { Env } from '../config/env.js';
import type { RedisClient } from '../db/redis.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildQueryFromPost } from '../services/postContextQuery.js';
import { runExaSearch } from '../services/exaSearch.service.js';
import { consumeSearchToolSlot } from '../services/searchToolRateLimit.js';
import { getPostById } from '../services/post.service.js';
import type { RelatedWebBody } from '../validators/relatedWeb.validator.js';

export function createExaController(env: Env, redis: RedisClient) {
  return {
    relatedWeb: asyncHandler(async (req, res) => {
      if (!env.EXA_API_KEY?.trim()) {
        throw new AppError(
          503,
          'Exa search is not configured. Set EXA_API_KEY on the API server.',
        );
      }
      const userId = req.auth?.userId;
      if (!userId) {
        throw new AppError(401, 'Sign in to fetch Exa results');
      }

      await consumeSearchToolSlot(redis, userId, 'exa', {
        redisMax: 15,
        memoryMax: 12,
        message:
          'Exa search hourly limit reached for your account. Try again later.',
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
        throw new AppError(
          400,
          'Could not build a search query; add a manual q or use a richer post.',
        );
      }

      const results = await runExaSearch(env.EXA_API_KEY.trim(), query);

      res.json({
        query,
        source: 'exa',
        disclaimer:
          'Semantic web results from Exa for context only — not verified by CivicPulse.',
        results,
      });
    }),
  };
}
