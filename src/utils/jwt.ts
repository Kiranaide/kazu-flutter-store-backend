import { sign, verify } from 'hono/jwt';

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
}

export const signJWT = async (
  payload: JWTPayload,
  secret: string,
  expiresIn: number = 60 * 60 * 24 * 7
): Promise<string> => {
  const tokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    iat: Math.floor(Date.now() / 1000),
  };

  return await sign(tokenPayload, secret);
};

export const verifyJWT = async (
  token: string,
  secret: string
): Promise<JWTPayload> => {
  const payload = await verify(token, secret, 'HS256');
  return payload as unknown as JWTPayload;
};
