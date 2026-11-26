import { useMemo, useSyncExternalStore } from 'react';
import { useTasks, type Task } from './tasks.ts';

export type Group = { id: string; title: string; tone?: 'alert'; tasks: Task[] };
export type ListFilter = (t: Task) => boolean;
export type ListArrangement = (tasks: Task[], now: Date) => Group[];

type View = { filter: ListFilter | null; arrangement: ListArrangement | null };

let view: View = { filter: null, arrangement: null };
const listeners = new Set<() => void>();

function setView(patch: Partial<View>) {
  view = { ...view, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The rows the list shows; null shows every task. */
export function setListFilter(fn: ListFilter | null): void {
  setView({ filter: fn });
}

/** How the rows are grouped; null is one untitled group, oldest first. */
export function setListArrangement(fn: ListArrangement | null): void {
  setView({ arrangement: fn });
}

/** The current filter and arrangement (used by the shell). */
export function useListView(): View {
  return useSyncExternalStore(subscribe, () => view, () => view);
}

const byCreated = (a: Task, b: Task) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);

/** Filters first, then arranges; drops groups with no task. */
export function arrangeTasks(tasks: Task[], now: Date, v: View = view): Group[] {
  const rows = v.filter ? tasks.filter(v.filter) : tasks;
  const groups = v.arrangement
    ? v.arrangement(rows, now)
    : [{ id: 'all', title: '', tasks: [...rows].sort(byCreated) }];
  return groups.filter((g) => g.tasks.length > 0);
}

/** Counts over all tasks, ignoring the filter. */
export function useListCounts(): { all: number; open: number; done: number } {
  const { tasks } = useTasks();
  return useMemo(() => {
    const done = tasks.filter((t) => t.done).length;
    return { all: tasks.length, open: tasks.length - done, done };
  }, [tasks]);
}
