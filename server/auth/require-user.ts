import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE, SessionStore } from './sessions.ts';
import type { User } from './users.ts';

/** Hono env for routes behind requireUser: c.get('user') is the signed-in user. */
export type AuthEnv = { Variables: { user: User } };

/** Reads cookie sid; with a live session sets c.get('user') to { id, email }, otherwise answers 401 {"error":"unauthenticated"}. */
export const requireUser: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  const user = token ? SessionStore.findUser(token) : null;
  if (!user) return c.json({ error: 'unauthenticated' }, 401);
  c.set('user', user);
  await next();
};
