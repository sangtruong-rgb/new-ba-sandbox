import { api, reload } from '../../../web/tasks.ts';

// Leaving a field happens on pointer down. Whatever moves the page (an error line, a re-arranged
// list) waits for the click to finish, so the button or row being pressed does not slip away.
let press: Promise<void> = Promise.resolve();

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    () => {
      press = new Promise((done) => {
        const up = () => {
          document.removeEventListener('pointerup', up, true);
          document.removeEventListener('pointercancel', up, true);
          done();
        };
        document.addEventListener('pointerup', up, true);
        document.addEventListener('pointercancel', up, true);
      });
    },
    true,
  );
}

/** Resolves once no pointer is held down and the click it makes has been handled. */
export const released = (): Promise<void> => press.then(() => new Promise((done) => setTimeout(done)));

// One request at a time, so a later change is never overwritten by an earlier one.
let queue: Promise<unknown> = Promise.resolve();

/** Saves a change and reloads the list; false when the server did not take it. */
export async function saveTask(id: string, patch: { title?: string; dueAt?: string | null }): Promise<boolean> {
  const sent = queue.then(() =>
    api(`/tasks/${id}`, { method: 'PATCH', body: patch }).then(
      () => true,
      // api() already showed the error line, reloaded on 404 or signed out on 401.
      () => false,
    ),
  );
  queue = sent;
  if (!(await sent)) return false;
  await released();
  await reload();
  return true;
}
