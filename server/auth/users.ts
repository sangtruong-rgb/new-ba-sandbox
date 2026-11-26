import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, nowIso } from '../db/client.ts';
import { users } from '../db/schema.ts';

export type User = { id: string; email: string };

export class EmailTakenError extends Error {
  constructor(message = 'email_taken') {
    super(message);
    this.name = 'EmailTakenError';
  }
}

const lower = (email: string) => email.toLowerCase();

export const UserStore = {
  /** Stores the email in lower case; throws EmailTakenError when it exists in any case. */
  create(email: string, passwordHash: string): User {
    const id = randomUUID();
    const stored = lower(email);
    try {
      getDb().insert(users).values({ id, email: stored, passwordHash, createdAt: nowIso() }).run();
    } catch (e) {
      if (e instanceof Error && /UNIQUE/i.test(e.message)) throw new EmailTakenError();
      throw e;
    }
    return { id, email: stored };
  },

  /** Ignores case. */
  findByEmail(email: string): (User & { passwordHash: string }) | null {
    const row = getDb().select().from(users).where(eq(users.email, lower(email))).get();
    return row ? { id: row.id, email: row.email, passwordHash: row.passwordHash } : null;
  },
};
