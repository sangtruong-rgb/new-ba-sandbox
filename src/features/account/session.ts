import { useSyncExternalStore } from 'react';
import { api, reset } from '../../../web/tasks.ts';

export type Me = { id: string; email: string };

/** loading: GET /api/me has not answered yet. out: the sign-in screen, with the "session ended" line or not. */
export type Auth = { status: 'loading' } | { status: 'in'; user: Me } | { status: 'out'; ended: boolean };

let auth: Auth = { status: 'loading' };
const listeners = new Set<() => void>();

export function setAuth(next: Auth): void {
  auth = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuth(): Auth {
  return useSyncExternalStore(subscribe, () => auth, () => auth);
}

let checking: Promise<void> | null = null;

/** Asks the server who is signed in (once at a time). */
export function checkSession(): Promise<void> {
  checking ??= (async () => {
    try {
      const user = (await api('/me', { authCheck: true })) as Me;
      setAuth({ status: 'in', user: { id: user.id, email: user.email } });
    } catch {
      setAuth({ status: 'out', ended: false });
    } finally {
      checking = null;
    }
  })();
  return checking;
}

/** Ends the session on the server, empties the page's tasks and shows the sign-in screen. */
export async function signOut(): Promise<void> {
  try {
    await api('/account/signout', { method: 'POST', authCheck: true });
  } catch {
    // Still leave the page signed out.
  }
  reset();
  setAuth({ status: 'out', ended: false });
}

/** For tests: back to the state of a fresh page. */
export function resetAuth(): void {
  checking = null;
  setAuth({ status: 'loading' });
}
