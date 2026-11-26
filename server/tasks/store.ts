import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb, nowIso } from '../db/client.ts';
import { tasks } from '../db/schema.ts';

/** Dates are ISO 8601 strings in UTC. */
export type Task = {
  id: string;
  title: string;
  done: boolean;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
};

/** Thrown for a task that does not exist or belongs to another user; every route answers it with 404. */
export class NotFoundError extends Error {
  constructor(message = 'not_found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

type Row = typeof tasks.$inferSelect;

const toTask = (r: Row): Task => ({
  id: r.id,
  title: r.title,
  done: r.done,
  dueAt: r.dueAt,
  doneAt: r.doneAt,
  createdAt: r.createdAt,
});

function find(userId: string, id: string): Row {
  const row = getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .get();
  if (!row) throw new NotFoundError();
  return row;
}

export const TaskStore = {
  /** The user's tasks, oldest first. */
  list(userId: string): Task[] {
    return getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(asc(tasks.createdAt), asc(sql`rowid`))
      .all()
      .map(toTask);
  },

  create(userId: string, input: { title: string; dueAt: string | null }): Task {
    const row = getDb()
      .insert(tasks)
      .values({
        id: randomUUID(),
        userId,
        title: input.title,
        done: false,
        dueAt: input.dueAt,
        doneAt: null,
        createdAt: nowIso(),
      })
      .returning()
      .get();
    return toTask(row);
  },

  /** doneAt becomes now when done turns true and null when it is false. */
  update(
    userId: string,
    id: string,
    patch: { title?: string; done?: boolean; dueAt?: string | null },
  ): Task {
    const row = find(userId, id);
    const set: Partial<Row> = {};
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.dueAt !== undefined) set.dueAt = patch.dueAt;
    if (patch.done !== undefined) {
      set.done = patch.done;
      if (patch.done && !row.done) set.doneAt = nowIso();
      if (!patch.done) set.doneAt = null;
    }
    if (Object.keys(set).length === 0) return toTask(row);
    const updated = getDb()
      .update(tasks)
      .set(set)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning()
      .get();
    return toTask(updated!);
  },

  remove(userId: string, id: string): void {
    find(userId, id);
    getDb()
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .run();
  },
};

/**
 * Test support (e2e seedTasks): writes a task with explicit timestamps.
 * A done task without doneAt gets now.
 */
export function insertTask(
  userId: string,
  input: { title: string; dueAt?: string | null; done?: boolean; createdAt?: string; doneAt?: string | null },
): Task {
  const done = input.done ?? false;
  const row = getDb()
    .insert(tasks)
    .values({
      id: randomUUID(),
      userId,
      title: input.title,
      done,
      dueAt: input.dueAt ?? null,
      doneAt: done ? (input.doneAt ?? nowIso()) : null,
      createdAt: input.createdAt ?? nowIso(),
    })
    .returning()
    .get();
  return toTask(row);
}
