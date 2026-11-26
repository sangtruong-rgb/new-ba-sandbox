import { Hono } from 'hono';
import { beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '../db/client.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { requireUser, type AuthEnv } from './require-user.ts';
import { SessionStore } from './sessions.ts';
import { EmailTakenError, UserStore } from './users.ts';

beforeEach(() => closeDb());

const columns = (table: string) =>
  (getDb().$client.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name).sort();

describe('tables', () => {
  test('C3 migration creates users and sessions', () => {
    expect(columns('users')).toEqual(['created_at', 'email', 'id', 'password_hash']);
    expect(columns('sessions')).toEqual(['expires_at', 'token', 'user_id']);
  });

  test('C3 users.email is unique ignoring case at the database level', () => {
    const insert = getDb().$client.prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'h', '2026-11-26T00:00:00.000Z')",
    );
    insert.run('1', 'a@example.com');
    expect(() => insert.run('2', 'A@Example.com')).toThrow(/UNIQUE/);
  });
});

describe('UserStore', () => {
  test('C3 create stores the email in lower case', () => {
    const u = UserStore.create('Minh.Thu@Example.COM', 'hash');
    expect(u).toEqual({ id: expect.any(String), email: 'minh.thu@example.com' });
  });

  test('C3 create throws EmailTakenError when the email exists in any case', () => {
    UserStore.create('thu@example.com', 'hash');
    expect(() => UserStore.create('THU@example.com', 'other')).toThrow(EmailTakenError);
  });

  test('C3 findByEmail ignores case and returns the password hash', () => {
    const u = UserStore.create('thu@example.com', 'hash-1');
    expect(UserStore.findByEmail('Thu@EXAMPLE.com')).toEqual({ ...u, passwordHash: 'hash-1' });
    expect(UserStore.findByEmail('nobody@example.com')).toBeNull();
  });
});

describe('PasswordHash', () => {
  test('C3 hashPassword uses scrypt with a salt; verifyPassword checks it', async () => {
    const a = await hashPassword('mat-khau-1');
    const b = await hashPassword('mat-khau-1');
    expect(a).toMatch(/^scrypt\$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('mat-khau-1');
    expect(await verifyPassword('mat-khau-1', a)).toBe(true);
    expect(await verifyPassword('mat-khau-2', a)).toBe(false);
    expect(await verifyPassword('mat-khau-1', 'garbage')).toBe(false);
  });
});

describe('SessionStore', () => {
  test('C3 create makes a session valid 30 days', () => {
    const u = UserStore.create('s@example.com', 'h');
    const before = Date.now();
    const s = SessionStore.create(u.id);
    expect(s.token.length).toBeGreaterThanOrEqual(32);
    const ms = Date.parse(s.expiresAt) - before;
    expect(Math.abs(ms - 30 * 24 * 3600 * 1000)).toBeLessThan(5000);
    expect(SessionStore.findUser(s.token)).toEqual(u);
  });

  test('C3 cookie gives the exact Set-Cookie value', () => {
    expect(SessionStore.cookie('abc')).toBe('sid=abc; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000');
  });

  test('C3 destroy ends the session', () => {
    const u = UserStore.create('d@example.com', 'h');
    const s = SessionStore.create(u.id);
    SessionStore.destroy(s.token);
    expect(SessionStore.findUser(s.token)).toBeNull();
  });
});

describe('requireUser', () => {
  const app = new Hono<AuthEnv>();
  app.get('/me', requireUser, (c) => c.json(c.get('user')));

  test('C3 answers 401 {"error":"unauthenticated"} without a live session', async () => {
    const none = await app.request('/me');
    expect(none.status).toBe(401);
    expect(await none.json()).toEqual({ error: 'unauthenticated' });
    const bad = await app.request('/me', { headers: { Cookie: 'sid=nope' } });
    expect(bad.status).toBe(401);
  });

  test('C3 answers 401 for an expired session', async () => {
    const u = UserStore.create('old@example.com', 'h');
    getDb()
      .$client.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES ('old', ?, '2020-01-01T00:00:00.000Z')")
      .run(u.id);
    const res = await app.request('/me', { headers: { Cookie: 'sid=old' } });
    expect(res.status).toBe(401);
  });

  test('C3 sets c.get("user") to { id, email } with a live session', async () => {
    const u = UserStore.create('live@example.com', 'h');
    const { token } = SessionStore.create(u.id);
    const res = await app.request('/me', { headers: { Cookie: `sid=${token}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: u.id, email: 'live@example.com' });
  });
});
