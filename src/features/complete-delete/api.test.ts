import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../../../server/app.ts';
import { SessionStore } from '../../../server/auth/sessions.ts';
import { UserStore } from '../../../server/auth/users.ts';
import { closeDb } from '../../../server/db/client.ts';
import { TaskStore, insertTask } from '../../../server/tasks/store.ts';
import feature from './api.ts';

beforeEach(() => closeDb());

function signIn(email: string) {
  const user = UserStore.create(email, 'h');
  const { token } = SessionStore.create(user.id);
  return { user, headers: { Cookie: `sid=${token}`, 'Content-Type': 'application/json' } };
}

const app = () => createApp([feature]);

const putDone = (id: string, headers: Record<string, string>, body: unknown) =>
  app().request(`/api/tasks/${id}/done`, { method: 'PUT', headers, body: JSON.stringify(body) });

const del = (id: string, headers: Record<string, string>) =>
  app().request(`/api/tasks/${id}`, { method: 'DELETE', headers });

describe('complete and delete routes', () => {
  test('C31 PUT done changes the signed-in user’s task, both ways', async () => {
    const { user, headers } = signIn('a@example.com');
    const t = insertTask(user.id, { title: 'việc' });
    expect((await putDone(t.id, headers, { done: true })).status).toBe(200);
    expect(TaskStore.list(user.id)[0]).toMatchObject({ done: true, doneAt: expect.any(String) });
    expect((await putDone(t.id, headers, { done: false })).status).toBe(200);
    expect(TaskStore.list(user.id)[0]).toMatchObject({ done: false, doneAt: null });
  });

  test('C31 DELETE removes only that task of the signed-in user', async () => {
    const { user, headers } = signIn('a@example.com');
    const gone = insertTask(user.id, { title: 'xóa' });
    insertTask(user.id, { title: 'giữ' });
    expect((await del(gone.id, headers)).status).toBe(204);
    expect(TaskStore.list(user.id).map((t) => t.title)).toEqual(['giữ']);
  });

  test('C31 another user’s task or a missing one answers 404 not_found and stays unchanged', async () => {
    const owner = signIn('owner@example.com');
    const other = signIn('other@example.com');
    const t = insertTask(owner.user.id, { title: 'của chủ' });
    for (const id of [t.id, 'khong-ton-tai']) {
      for (const res of [await putDone(id, other.headers, { done: true }), await del(id, other.headers)]) {
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
      }
    }
    expect(TaskStore.list(owner.user.id)).toEqual([t]);
  });

  test('C31 without a session both routes answer 401 and change nothing', async () => {
    const { user } = signIn('a@example.com');
    const t = insertTask(user.id, { title: 'việc' });
    expect((await putDone(t.id, {}, { done: true })).status).toBe(401);
    expect((await del(t.id, {})).status).toBe(401);
    expect(TaskStore.list(user.id)).toEqual([t]);
  });

  test('C31 a body without a boolean done answers 400 and changes nothing', async () => {
    const { user, headers } = signIn('a@example.com');
    const t = insertTask(user.id, { title: 'việc' });
    for (const body of [{}, { done: 'true' }, null]) {
      expect((await putDone(t.id, headers, body)).status).toBe(400);
    }
    expect(TaskStore.list(user.id)).toEqual([t]);
  });
});
