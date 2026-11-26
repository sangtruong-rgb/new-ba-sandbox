import { beforeEach, describe, expect, test } from 'vitest';
import { SessionStore } from './auth/sessions.ts';
import { UserStore } from './auth/users.ts';
import { closeDb } from './db/client.ts';
import { createApp } from './app.ts';
import type { FeatureApi } from './registry.ts';
import { NotFoundError, insertTask } from './tasks/store.ts';

beforeEach(() => closeDb());

function signIn(email = 'thu@example.com') {
  const user = UserStore.create(email, 'h');
  const { token } = SessionStore.create(user.id);
  return { user, headers: { Cookie: `sid=${token}` } };
}

describe('core routes', () => {
  test('C1 GET /api/health answers {"ok":true}', async () => {
    const res = await createApp([]).request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test('C2 GET /api/tasks answers the signed-in user’s tasks, oldest first', async () => {
    const { user, headers } = signIn();
    const other = UserStore.create('other@example.com', 'h');
    insertTask(user.id, { title: 'mới', createdAt: '2026-11-25T00:00:00.000Z' });
    insertTask(user.id, { title: 'cũ', createdAt: '2026-11-01T00:00:00.000Z' });
    insertTask(other.id, { title: 'của người khác' });
    const res = await createApp([]).request('/api/tasks', { headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title: string }[];
    expect(body.map((t) => t.title)).toEqual(['cũ', 'mới']);
  });

  test('C2 GET /api/tasks needs a session', async () => {
    const res = await createApp([]).request('/api/tasks');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  test('C2 NotFoundError from any route answers 404 {"error":"not_found"}', async () => {
    const { headers } = signIn();
    const feature: FeatureApi = {
      id: 'thrower',
      routes: [
        { method: 'DELETE', path: '/things/:id', handler: () => { throw new NotFoundError(); } },
        { method: 'GET', path: '/open', public: true, handler: async () => { throw new NotFoundError(); } },
      ],
    };
    const app = createApp([feature]);
    const a = await app.request('/api/things/1', { method: 'DELETE', headers });
    expect(a.status).toBe(404);
    expect(await a.json()).toEqual({ error: 'not_found' });
    const b = await app.request('/api/open');
    expect(b.status).toBe(404);
    expect(await b.json()).toEqual({ error: 'not_found' });
  });
});

describe('FeatureApi registry', () => {
  const echo: FeatureApi = {
    id: 'echo',
    routes: [
      { method: 'GET', path: '/echo', handler: (c) => c.json({ user: c.get('user').email }) },
      { method: 'POST', path: '/ping', public: true, handler: (c) => c.json({ pong: true }) },
    ],
  };

  test('C4 a feature route is mounted at /api + path behind requireUser', async () => {
    const app = createApp([echo]);
    expect((await app.request('/api/echo')).status).toBe(401);
    const { headers } = signIn('echo@example.com');
    const res = await app.request('/api/echo', { headers });
    expect(await res.json()).toEqual({ user: 'echo@example.com' });
  });

  test('C4 a public route answers without a session', async () => {
    const res = await createApp([echo]).request('/api/ping', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
  });

  test('C4 a method and path declared by two features throws, naming both', () => {
    const a: FeatureApi = { id: 'add-task', routes: [{ method: 'POST', path: '/tasks', handler: (c) => c.body(null) }] };
    const b: FeatureApi = { id: 'quick-add', routes: [{ method: 'POST', path: '/tasks', handler: (c) => c.body(null) }] };
    expect(() => createApp([a, b])).toThrow(/POST \/tasks.*"add-task".*"quick-add"/);
  });

  test('C4 the same path with another method is not a clash', () => {
    const a: FeatureApi = { id: 'a', routes: [{ method: 'PATCH', path: '/tasks/:id', handler: (c) => c.body(null) }] };
    const b: FeatureApi = { id: 'b', routes: [{ method: 'DELETE', path: '/tasks/:id', handler: (c) => c.body(null) }] };
    expect(() => createApp([a, b])).not.toThrow();
  });

  test('C4 a feature cannot take a route the server declares', () => {
    const a: FeatureApi = { id: 'mine', routes: [{ method: 'GET', path: '/tasks', handler: (c) => c.body(null) }] };
    expect(() => createApp([a])).toThrow(/GET \/tasks.*"server".*"mine"/);
  });
});
