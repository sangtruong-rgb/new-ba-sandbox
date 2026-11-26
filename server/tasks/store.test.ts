import { beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '../db/client.ts';
import { UserStore } from '../auth/users.ts';
import { NotFoundError, TaskStore, insertTask } from './store.ts';

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let alice: string;
let bob: string;

beforeEach(() => {
  closeDb();
  alice = UserStore.create('alice@example.com', 'h').id;
  bob = UserStore.create('bob@example.com', 'h').id;
});

describe('TaskStore', () => {
  test('C2 migration creates the tasks table with its columns', () => {
    const cols = getDb().$client.prepare('PRAGMA table_info(tasks)').all() as { name: string }[];
    expect(cols.map((c) => c.name).sort()).toEqual(
      ['created_at', 'done', 'done_at', 'due_at', 'id', 'title', 'user_id'].sort(),
    );
  });

  test('C2 create returns a Task with ISO 8601 UTC dates', () => {
    const t = TaskStore.create(alice, { title: 'Gửi báo giá', dueAt: '2026-11-28T16:59:00.000Z' });
    expect(t).toEqual({
      id: expect.any(String),
      title: 'Gửi báo giá',
      done: false,
      dueAt: '2026-11-28T16:59:00.000Z',
      doneAt: null,
      createdAt: expect.stringMatching(ISO_UTC),
    });
  });

  test('C2 list returns only the user’s tasks, oldest first', () => {
    insertTask(alice, { title: 'b', createdAt: '2026-11-20T00:00:00.000Z' });
    insertTask(alice, { title: 'a', createdAt: '2026-11-10T00:00:00.000Z' });
    insertTask(bob, { title: 'bob', createdAt: '2026-11-01T00:00:00.000Z' });
    TaskStore.create(alice, { title: 'c', dueAt: null });
    expect(TaskStore.list(alice).map((t) => t.title)).toEqual(['a', 'b', 'c']);
    expect(TaskStore.list(bob).map((t) => t.title)).toEqual(['bob']);
  });

  test('C2 update sets doneAt to now when done becomes true and null when false', () => {
    const t = TaskStore.create(alice, { title: 'x', dueAt: null });
    const before = Date.now();
    const done = TaskStore.update(alice, t.id, { done: true });
    expect(done.done).toBe(true);
    expect(done.doneAt).toMatch(ISO_UTC);
    expect(Date.parse(done.doneAt!)).toBeGreaterThanOrEqual(before - 5);
    const open = TaskStore.update(alice, t.id, { done: false });
    expect(open).toMatchObject({ done: false, doneAt: null });
  });

  test('C2 update changes title and dueAt and keeps the rest', () => {
    const t = TaskStore.create(alice, { title: 'x', dueAt: '2026-11-28T16:59:00.000Z' });
    const u = TaskStore.update(alice, t.id, { title: 'y', dueAt: null });
    expect(u).toEqual({ ...t, title: 'y', dueAt: null });
    expect(TaskStore.list(alice)).toEqual([u]);
  });

  test('C2 remove deletes the task', () => {
    const t = TaskStore.create(alice, { title: 'x', dueAt: null });
    TaskStore.remove(alice, t.id);
    expect(TaskStore.list(alice)).toEqual([]);
  });

  test('C2 another user’s task, or none, throws NotFoundError', () => {
    const t = TaskStore.create(alice, { title: 'x', dueAt: null });
    expect(() => TaskStore.update(bob, t.id, { title: 'y' })).toThrow(NotFoundError);
    expect(() => TaskStore.remove(bob, t.id)).toThrow(NotFoundError);
    expect(() => TaskStore.update(alice, 'missing', { done: true })).toThrow(NotFoundError);
    expect(() => TaskStore.remove(alice, 'missing')).toThrow(NotFoundError);
    expect(TaskStore.list(alice)).toEqual([t]);
  });
});
