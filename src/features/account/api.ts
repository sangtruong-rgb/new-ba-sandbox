import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { hashPassword, verifyPassword } from '../../../server/auth/password.ts';
import type { AuthEnv } from '../../../server/auth/require-user.ts';
import { SESSION_COOKIE, SessionStore } from '../../../server/auth/sessions.ts';
import { EmailTakenError, UserStore, type User } from '../../../server/auth/users.ts';
import type { FeatureApi } from '../../../server/registry.ts';
import { signUpProblem } from './rules.ts';

const CLEAR_COOKIE = `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;

async function body(c: Context<AuthEnv>): Promise<{ email?: unknown; password?: unknown }> {
  try {
    const data: unknown = await c.req.json();
    return data && typeof data === 'object' ? (data as { email?: unknown; password?: unknown }) : {};
  } catch {
    return {};
  }
}

/**
 * Refuses a cross-site request before it is read (login CSRF): the body must be JSON, which a
 * plain HTML form cannot send, and a browser's Origin (or Sec-Fetch-Site) must be this site.
 */
function crossSite(c: Context<AuthEnv>): Response | null {
  const type = (c.req.header('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return c.json({ error: 'unsupported_media_type' }, 415);
  const site = c.req.header('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return c.json({ error: 'forbidden' }, 403);
  const origin = c.req.header('origin');
  if (origin !== undefined) {
    let host: string | null = null;
    try {
      host = new URL(origin).host;
    } catch {
      // "null" or garbage: not this site.
    }
    const own = c.req.header('host') ?? new URL(c.req.url).host;
    if (host !== own) return c.json({ error: 'forbidden' }, 403);
  }
  return null;
}

/** Starts a session for the user and answers { id, email } with its cookie. */
function signedIn(c: Context<AuthEnv>, user: User, status: 200 | 201) {
  const { token } = SessionStore.create(user.id);
  c.header('Set-Cookie', SessionStore.cookie(token));
  return c.json({ id: user.id, email: user.email }, status);
}

const api: FeatureApi = {
  id: 'account',
  routes: [
    {
      method: 'POST',
      path: '/account/signup',
      public: true,
      handler: async (c) => {
        const refused = crossSite(c);
        if (refused) return refused;
        const { email, password } = await body(c);
        const problem = signUpProblem(email, password);
        if (problem) return c.json({ error: problem }, 400);
        const hash = await hashPassword(password as string);
        try {
          return signedIn(c, UserStore.create(email as string, hash), 201);
        } catch (e) {
          if (e instanceof EmailTakenError) return c.json({ error: 'email_taken' }, 409);
          throw e;
        }
      },
    },
    {
      method: 'POST',
      path: '/account/signin',
      public: true,
      handler: async (c) => {
        const refused = crossSite(c);
        if (refused) return refused;
        const { email, password } = await body(c);
        const found = typeof email === 'string' && email ? UserStore.findByEmail(email) : null;
        const ok = found !== null && typeof password === 'string' && (await verifyPassword(password, found.passwordHash));
        if (!ok) return c.json({ error: 'invalid_credentials' }, 401);
        return signedIn(c, { id: found.id, email: found.email }, 200);
      },
    },
    {
      method: 'POST',
      path: '/account/signout',
      public: true,
      handler: (c) => {
        const refused = crossSite(c);
        if (refused) return refused;
        const token = getCookie(c, SESSION_COOKIE);
        if (token) SessionStore.destroy(token);
        c.header('Set-Cookie', CLEAR_COOKIE);
        return c.json({ ok: true });
      },
    },
    {
      method: 'GET',
      path: '/me',
      handler: (c) => {
        const { id, email } = c.get('user');
        return c.json({ id, email });
      },
    },
  ],
};

export default api;
