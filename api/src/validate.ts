import { z } from 'zod';
import { AppError } from './errors.js';

/** Parse input with a Zod schema, turning failures into a safe 400 response. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  throw new AppError(400, 'VALIDATION_FAILED', issues[0]?.message ?? 'Invalid request', { issues });
}

export const UuidParam = z.object({ id: z.uuid() });

/** Treat malformed ids as "not found" rather than leaking parser details. */
export function parseId(params: unknown): string {
  const result = UuidParam.safeParse(params);
  if (!result.success) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return result.data.id;
}

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
