import type { Context, Next } from 'hono';
import { ZodError } from 'zod';
import { HTTPException } from 'hono/http-exception';

interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}

export const errorHandler = async (err: Error, c: Context): Promise<Response> => {
  console.error('Error:', err);

  if (err instanceof ZodError) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Validation failed',
      details: err.issues.map((e) => ({
        path: e.path.map(String).join('.'),
        message: e.message,
      })),
    };
    return c.json(errorResponse, 400);
  }

  if (err instanceof HTTPException) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: err.message,
    };
    return c.json(errorResponse, err.status);
  }

  if (err.message?.includes('drizzle') || err.message?.includes('database')) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Database error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    };
    return c.json(errorResponse, 500);
  }

  const errorResponse: ErrorResponse = {
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  };
  return c.json(errorResponse, 500);
};

export const notFoundHandler = (c: Context) => {
  const errorResponse: ErrorResponse = {
    success: false,
    error: 'Resource not found',
  };
  return c.json(errorResponse, 404);
};
