import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../../../server/app.ts';
import { SessionStore } from '../../../server/auth/sessions.ts';
import { UserStore } from '../../../server/auth/users.ts';
import { closeDb } from '../../../server/db/client.ts';
import { TaskStore } from '../../../server/tasks/store.ts';
import feature from './api.ts';

beforeEach(() => closeDb());

function signIn() {
  const user = UserStore.create('thu@example.com', 'h');
  const headers = { Cookie: `sid=${SessionStore.create(user.id).token}`, 'Content-Type': 'application/json' };
  const post = (body: string) => createApp([feature]).request('/api/tasks', { method: 'POST', headers, body });
  return { user, post };
}

describe('POST /api/tasks', () => {
  test('C24 creates a task for the signed-in user and answers it, title trimmed', async () => {
    const { user, post } = signIn();
    const res = await post(JSON.stringify({ title: '  Mua sữa ', dueAt: '2026-11-28T16:59:00.000Z' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ title: 'Mua sữa', dueAt: '2026-11-28T16:59:00.000Z', done: false });
    expect(TaskStore.list(user.id)).toEqual([body]);
  });

  test('C24 an invalid title answers 400 and creates nothing', async () => {
    const { user, post } = signIn();
    for (const [body, error] of [
      [JSON.stringify({ title: '   ', dueAt: null }), 'title_required'],
      [JSON.stringify({ dueAt: null }), 'title_required'],
      ['not json', 'title_required'],
      [JSON.stringify({ title: 'a'.repeat(201), dueAt: null }), 'title_too_long'],
    ] as const) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error });
    }
    expect(TaskStore.list(user.id)).toEqual([]);
  });

  test('C24 a dueAt that is not a date is refused', async () => {
    const { user, post } = signIn();
    for (const dueAt of ['mai', 5]) {
      expect((await post(JSON.stringify({ title: 'a', dueAt }))).status).toBe(400);
    }
    expect(TaskStore.list(user.id)).toEqual([]);
  });

  test('C24 needs a session', async () => {
    const res = await createApp([feature]).request('/api/tasks', { method: 'POST', body: '{"title":"a"}' });
    expect(res.status).toBe(401);
  });
});
