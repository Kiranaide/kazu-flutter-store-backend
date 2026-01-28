import { zValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: result.error.issues.map((e) => ({
            path: e.path.map(String).join('.'),
            message: e.message,
          })),
        },
        400
      );
    }
  });
};

export const validateQuery = (schema: ZodSchema) => {
  return zValidator('query', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: 'Query validation failed',
          details: result.error.issues.map((e) => ({
            path: e.path.map(String).join('.'),
            message: e.message,
          })),
        },
        400
      );
    }
  });
};

export const validateParams = (schema: ZodSchema) => {
  return zValidator('param', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: 'Parameter validation failed',
          details: result.error.issues.map((e) => ({
            path: e.path.map(String).join('.'),
            message: e.message,
          })),
        },
        400
      );
    }
  });
};
