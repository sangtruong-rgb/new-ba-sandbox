import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { sessions, users } from '../db/schema.ts';
import type { User } from './users.ts';

export const SESSION_SECONDS = 30 * 24 * 60 * 60; // 30 days = 2592000
export const SESSION_COOKIE = 'sid';

export const SessionStore = {
  /** A new session for the user, valid 30 days. */
  create(userId: string): { token: string; expiresAt: string } {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
    getDb().insert(sessions).values({ token, userId, expiresAt }).run();
    return { token, expiresAt };
  },

  destroy(token: string): void {
    getDb().delete(sessions).where(eq(sessions.token, token)).run();
  },

  /** The Set-Cookie value for the session. */
  cookie(token: string): string {
    return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
  },

  /** The user of a live (not expired) session, or null. */
  findUser(token: string): User | null {
    const row = getDb()
      .select({ id: users.id, email: users.email })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date().toISOString())))
      .get();
    return row ?? null;
  },
};
