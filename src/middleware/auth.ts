import { jwt } from 'hono/jwt';
import type { MiddlewareHandler } from 'hono';
import type { Context, Next } from 'hono';

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
}

export type Variables = {
  jwtPayload: JWTPayload;
};

export const requireAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const jwtMiddleware = jwt({
    secret: c.env.JWT_SECRET,
    alg: 'HS256',
  });
  return jwtMiddleware(c, next);
};

export const requireRole = (allowedRoles: string[]): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const payload = c.get('jwtPayload') as JWTPayload;
    
    if (!payload) {
      return c.json(
        { success: false, error: 'Unauthorized' },
        401
      );
    }

    if (!allowedRoles.includes(payload.role)) {
      return c.json(
        { success: false, error: 'Forbidden: Insufficient permissions' },
        403
      );
    }

    await next();
  };
};
