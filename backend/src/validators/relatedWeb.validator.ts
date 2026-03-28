import { z } from 'zod';

/** Shared body for Apify + Exa “related web” from a post or manual query. */
export const relatedWebBodySchema = z
  .object({
    postId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    q: z.string().trim().min(4).max(180).optional(),
  })
  .refine((d) => Boolean(d.postId?.trim()) || Boolean(d.q?.trim()), {
    message: 'Provide postId, q, or both',
  });

export type RelatedWebBody = z.infer<typeof relatedWebBodySchema>;
