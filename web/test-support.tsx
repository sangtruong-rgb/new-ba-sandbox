// Helpers for the web unit tests (jsdom).
import { vi } from 'vitest';
import type { Task } from './tasks.ts';

let n = 0;

export function task(over: Partial<Task> = {}): Task {
  n++;
  return {
    id: `t${n}`,
    title: `Việc ${n}`,
    done: false,
    dueAt: null,
    doneAt: null,
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, n)).toISOString(),
    ...over,
  };
}

type Reply = { status: number; body?: unknown } | 'network';

/** Replaces fetch; `route` answers each call by method and URL. */
export function mockFetch(route: (method: string, url: string, body: unknown) => Reply) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const reply = route(method, url, init?.body ? JSON.parse(String(init.body)) : undefined);
    if (reply === 'network') throw new TypeError('Failed to fetch');
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
