import { z } from 'zod';

export const v0SketchBodySchema = z.object({
  prompt: z.string().trim().min(20).max(900),
});

export type V0SketchBody = z.infer<typeof v0SketchBodySchema>;
