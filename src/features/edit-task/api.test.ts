import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../../../server/app.ts';
import { SessionStore } from '../../../server/auth/sessions.ts';
import { UserStore } from '../../../server/auth/users.ts';
import { closeDb } from '../../../server/db/client.ts';
import { TaskStore } from '../../../server/tasks/store.ts';
import feature from './api.ts';

beforeEach(() => closeDb());

const DUE = '2026-11-28T16:59:00.000Z';

function signIn(email = 'thu@example.com') {
  const user = UserStore.create(email, 'h');
  const headers = { Cookie: `sid=${SessionStore.create(user.id).token}`, 'Content-Type': 'application/json' };
  const patch = (id: string, body: unknown) =>
    createApp([feature]).request(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { user, patch };
}

describe('PATCH /api/tasks/:id', () => {
  test('C52 changes the title (trimmed) and the due time, each on its own', async () => {
    const { user, patch } = signIn();
    const task = TaskStore.create(user.id, { title: 'Cũ', dueAt: null });
    const renamed = await patch(task.id, { title: '  Mới ' });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({ title: 'Mới', dueAt: null });
    expect((await patch(task.id, { dueAt: DUE })).status).toBe(200);
    expect(TaskStore.list(user.id)[0]).toMatchObject({ title: 'Mới', dueAt: DUE });
    expect((await patch(task.id, { dueAt: null, done: true })).status).toBe(200);
    expect(TaskStore.list(user.id)[0]).toMatchObject({ title: 'Mới', dueAt: null, done: false });
  });

  test('C52 an invalid title or due time answers 400 and changes nothing', async () => {
    const { user, patch } = signIn();
    const task = TaskStore.create(user.id, { title: 'Cũ', dueAt: DUE });
    for (const [body, error] of [
      [{ title: '   ', dueAt: null }, 'title_required'],
      [{ title: 5 }, 'title_required'],
      [{ title: 'a'.repeat(201) }, 'title_too_long'],
      [{ dueAt: 'mai' }, 'invalid_due'],
      ['not json', 'invalid_input'],
    ] as const) {
      const res = await patch(task.id, body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error });
    }
    expect(TaskStore.list(user.id)).toEqual([task]);
  });

  test("C52 another user's task, or none, answers 404 and is not changed", async () => {
    const owner = signIn();
    const other = signIn('khac@example.com');
    const task = TaskStore.create(owner.user.id, { title: 'Cũ', dueAt: null });
    for (const id of [task.id, 'khong-co']) {
      const res = await other.patch(id, { title: 'Mới' });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_found' });
    }
    expect(TaskStore.list(owner.user.id)).toEqual([task]);
  });

  test('C52 needs a session', async () => {
    const res = await createApp([feature]).request('/api/tasks/a', { method: 'PATCH', body: '{"title":"a"}' });
    expect(res.status).toBe(401);
  });
});
