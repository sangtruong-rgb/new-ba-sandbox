import { useSyncExternalStore } from 'react';
import { setListFilter, type ListFilter } from '../../../web/list.ts';

export const STORAGE_KEY = 'todo.filter';

export type Filter = 'all' | 'open' | 'done';

const PREDICATES: Record<Filter, ListFilter | null> = {
  all: null,
  open: (t) => !t.done,
  done: (t) => t.done,
};

/** The stored choice; 'all' when there is none, it is unknown, or storage is blocked. */
function stored(): Filter {
  if (typeof window === 'undefined') return 'all';
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'open' || value === 'done' ? value : 'all';
  } catch {
    return 'all';
  }
}

let current = stored();
const listeners = new Set<() => void>();
// Applied on load, so the list is already filtered when it first draws.
setListFilter(PREDICATES[current]);

export function selectFilter(filter: Filter): void {
  current = filter;
  setListFilter(PREDICATES[filter]);
  try {
    window.localStorage.setItem(STORAGE_KEY, filter);
  } catch {
    // Storage blocked or full: the choice lasts until the page is reloaded.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFilter(): Filter {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
