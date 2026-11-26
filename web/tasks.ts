import { useEffect, useSyncExternalStore } from 'react';

/** Dates are ISO 8601 strings in UTC. */
export type Task = {
  id: string;
  title: string;
  done: boolean;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
};

export class ApiError extends Error {
  status: number;
  error: string;
  constructor(status: number, error: string) {
    super(error);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
  }
}

export const CONNECTION_ERROR = 'Không kết nối được máy chủ. Thử lại sau.';
export const UNAUTHENTICATED_EVENT = 'todo:unauthenticated';
const ERROR_MS = 5000;

type State = {
  tasks: Task[];
  selected: string | null;
  /** The tasks of a signed-in user have been loaded. */
  loaded: boolean;
  error: string | null;
};

let state: State = { tasks: [], selected: null, loaded: false, error: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useStore<T>(pick: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => pick(state), () => pick(state));
}

let errorTimer: ReturnType<typeof setTimeout> | undefined;

function showConnectionError() {
  clearTimeout(errorTimer);
  setState({ error: CONNECTION_ERROR });
  errorTimer = setTimeout(() => setState({ error: null }), ERROR_MS);
}

const toUrl = (path: string) => (path === '/api' || path.startsWith('/api/') ? path : '/api' + path);
const isTaskList = (path: string) => toUrl(path).split('?')[0] === '/api/tasks';

/** Calls the API; throws ApiError on a non-2xx answer (status 0 when the network fails). */
export async function api(
  path: string,
  init: { method?: string; body?: unknown; authCheck?: boolean } = {},
): Promise<unknown> {
  const method = init.method ?? 'GET';
  let res: Response;
  try {
    res = await fetch(toUrl(path), {
      method,
      credentials: 'same-origin',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    showConnectionError();
    throw new ApiError(0, 'network');
  }

  const text = await res.text().catch(() => '');
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (res.ok) return data;

  const error =
    data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
      ? (data as { error: string }).error
      : `http_${res.status}`;

  if (res.status === 401 && !init.authCheck) {
    const hadTasks = state.loaded;
    reset();
    if (hadTasks) window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
  } else if (res.status === 404 && !isTaskList(path)) {
    void reload();
  } else if (res.status >= 500) {
    showConnectionError();
  }
  throw new ApiError(res.status, error);
}

let generation = 0;
let inflight: Promise<void> | null = null;

/** Loads GET /api/tasks into the shared store; every consumer re-renders. Never rejects. */
export function reload(): Promise<void> {
  const mine = ++generation;
  const run = (async () => {
    try {
      const tasks = (await api('/tasks')) as Task[];
      if (mine !== generation) return;
      const selected = state.selected && tasks.some((t) => t.id === state.selected) ? state.selected : null;
      setState({ tasks, selected, loaded: true });
    } catch {
      // api() already showed the error line or handled 401.
    }
  })();
  inflight = run;
  void run.finally(() => {
    if (inflight === run) inflight = null;
  });
  return run;
}

/** The signed-in user's tasks; loads them when first rendered. */
export function useTasks(): { tasks: Task[]; reload(): Promise<void> } {
  const tasks = useStore((s) => s.tasks);
  useEffect(() => {
    if (!state.loaded && !inflight) void reload();
  }, []);
  return { tasks, reload };
}

function select(id: string | null) {
  setState({ selected: id });
}

/** The selected task id, shared by every slot. */
export function useSelection(): [string | null, (id: string | null) => void] {
  return [useStore((s) => s.selected), select];
}

/** Empties the tasks and the selection. */
export function reset(): void {
  generation++;
  setState({ tasks: [], selected: null, loaded: false });
}

/** The shell's error line: the message while it shows, else null. */
export function useShellError(): string | null {
  return useStore((s) => s.error);
}
