import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../../../server/app.ts';
import { closeDb, getDb } from '../../../server/db/client.ts';
import { insertTask } from '../../../server/tasks/store.ts';
import accountApi from './api.ts';
import { isValidEmail } from './rules.ts';

beforeEach(() => closeDb());

const app = () => createApp([accountApi]);

function post(path: string, body: unknown, cookie?: string) {
  return app().request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

const sid = (res: Response) => /sid=([^;]*)/.exec(res.headers.get('set-cookie') ?? '')?.[1] ?? '';
const userCount = () => (getDb().$client.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;

describe('sign up', () => {
  test('C12 a valid email and an 8-character password create the account and sign in', async () => {
    const res = await post('/api/account/signup', { email: 'Minh.Thu@Example.com', password: '12345678' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: expect.any(String), email: 'minh.thu@example.com' });
    expect(res.headers.get('set-cookie')).toMatch(/^sid=.+; HttpOnly; SameSite=Lax; Path=\/; Max-Age=2592000$/);
    const me = await app().request('/api/me', { headers: { Cookie: `sid=${sid(res)}` } });
    expect(await me.json()).toEqual(body);
    const tasks = await app().request('/api/tasks', { headers: { Cookie: `sid=${sid(res)}` } });
    expect(await tasks.json()).toEqual([]);
  });

  test('C13 errors come one at a time: email, then password, then email taken; no account is made', async () => {
    let res = await post('/api/account/signup', { email: 'not-an-email', password: '123' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_email' });
    res = await post('/api/account/signup', { email: 'thu@example.com', password: '1234567' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'password_too_short' });
    expect(userCount()).toBe(0);

    await post('/api/account/signup', { email: 'thu@example.com', password: '12345678' });
    res = await post('/api/account/signup', { email: 'THU@Example.com', password: 'another-pass' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'email_taken' });
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(userCount()).toBe(1);
  });

  test('C12 the email rule: one @, a dot after it, no whitespace', () => {
    for (const ok of ['a@b.c', 'minh.thu@example.com', 'x+y@mail.co.vn']) expect(isValidEmail(ok), ok).toBe(true);
    for (const bad of ['', 'abc', 'a@b', 'a@@b.c', 'a@b@c.d', 'a b@c.d', 'a@b.c ', ' a@b.c', 'a.b@c', '@b.c', 'a@b.']) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });
});

describe('sign in', () => {
  test('C14 the right email in any case and password sign in', async () => {
    await post('/api/account/signup', { email: 'thu@example.com', password: 'mat-khau-1' });
    const res = await post('/api/account/signin', { email: 'Thu@EXAMPLE.com', password: 'mat-khau-1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: expect.any(String), email: 'thu@example.com' });
    expect(sid(res).length).toBeGreaterThan(20);
  });

  test('C14 a wrong email and a wrong password answer the same', async () => {
    await post('/api/account/signup', { email: 'thu@example.com', password: 'mat-khau-1' });
    const wrongPass = await post('/api/account/signin', { email: 'thu@example.com', password: 'mat-khau-2' });
    const wrongEmail = await post('/api/account/signin', { email: 'nobody@example.com', password: 'mat-khau-1' });
    expect(wrongPass.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(await wrongPass.json()).toEqual(await wrongEmail.json());
    expect(wrongPass.headers.get('set-cookie')).toBeNull();
  });
});

describe('session', () => {
  test('C15 sign out ends the session: the old cookie gets 401 everywhere', async () => {
    const up = await post('/api/account/signup', { email: 'thu@example.com', password: 'mat-khau-1' });
    const cookie = `sid=${sid(up)}`;
    const out = await post('/api/account/signout', {}, cookie);
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toMatch(/^sid=; .*Max-Age=0/);
    for (const path of ['/api/me', '/api/tasks']) {
      const res = await app().request(path, { headers: { Cookie: cookie } });
      expect(res.status, path).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthenticated' });
    }
  });

  test('C16 GET /api/me answers { id, email } or 401 {"error":"unauthenticated"}', async () => {
    const anon = await app().request('/api/me');
    expect(anon.status).toBe(401);
    expect(await anon.json()).toEqual({ error: 'unauthenticated' });
    const up = await post('/api/account/signup', { email: 'thu@example.com', password: 'mat-khau-1' });
    const me = await app().request('/api/me', { headers: { Cookie: `sid=${sid(up)}` } });
    expect(Object.keys(await me.json()).sort()).toEqual(['email', 'id']);
  });

  test('C16 the password is stored only as a scrypt hash and never answered', async () => {
    const up = await post('/api/account/signup', { email: 'thu@example.com', password: 'mat-khau-1' });
    const row = getDb().$client.prepare('SELECT password_hash FROM users').get() as { password_hash: string };
    expect(row.password_hash).toMatch(/^scrypt\$/);
    expect(row.password_hash).not.toContain('mat-khau-1');
    const texts = [
      JSON.stringify(await up.json()),
      await (await post('/api/account/signin', { email: 'thu@example.com', password: 'mat-khau-1' })).text(),
      await (await app().request('/api/me', { headers: { Cookie: `sid=${sid(up)}` } })).text(),
    ];
    for (const t of texts) {
      expect(t).not.toMatch(/password|scrypt/i);
    }
  });

  test('C17 each account sees only its own tasks', async () => {
    const a = await post('/api/account/signup', { email: 'a@example.com', password: 'mat-khau-1' });
    const b = await post('/api/account/signup', { email: 'b@example.com', password: 'mat-khau-1' });
    const aUser = (await a.json()) as { id: string };
    insertTask(aUser.id, { title: 'Gia hạn hộ chiếu' });
    const again = await post('/api/account/signin', { email: 'a@example.com', password: 'mat-khau-1' });
    const list = async (cookie: string) =>
      ((await (await app().request('/api/tasks', { headers: { Cookie: cookie } })).json()) as { title: string }[]).map((t) => t.title);
    expect(await list(`sid=${sid(again)}`)).toEqual(['Gia hạn hộ chiếu']);
    expect(await list(`sid=${sid(b)}`)).toEqual([]);
  });
});
