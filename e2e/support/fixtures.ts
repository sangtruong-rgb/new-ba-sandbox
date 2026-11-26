import { randomUUID } from 'node:crypto';
import { test as base, expect, type Page } from '@playwright/test';
import { hashPassword } from '../../server/auth/password.ts';
import { SESSION_COOKIE, SessionStore } from '../../server/auth/sessions.ts';
import { UserStore } from '../../server/auth/users.ts';
import { insertTask, type Task } from '../../server/tasks/store.ts';

export type SeedTask = {
  title: string;
  dueAt?: string | null;
  done?: boolean;
  createdAt?: string;
  doneAt?: string | null;
};

type Fixtures = {
  /** The page is signed in as a new user (made through UserStore, hashPassword and SessionStore) and open at /. */
  signedIn: { email: string; password: string };
  /** Writes the tasks for the page's signed-in user through TaskStore, then reloads the page. */
  seedTasks: (page: Page, tasks: SeedTask[]) => Promise<Task[]>;
};

async function userOf(page: Page) {
  const sid = (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE);
  const user = sid ? SessionStore.findUser(sid.value) : null;
  if (!user) throw new Error('seedTasks needs a signed-in page (use the signedIn fixture)');
  return user;
}

export const test = base.extend<Fixtures>({
  signedIn: async ({ page, baseURL }, use) => {
    const email = `user-${randomUUID()}@example.com`;
    const password = 'mat-khau-rat-dai';
    const user = UserStore.create(email, await hashPassword(password));
    const { token } = SessionStore.create(user.id);
    await page.context().addCookies([
      { name: SESSION_COOKIE, value: token, url: baseURL!, httpOnly: true, sameSite: 'Lax' },
    ]);
    await page.goto('/');
    await use({ email, password });
  },

  seedTasks: async ({}, use) => {
    await use(async (page, tasks) => {
      const user = await userOf(page);
      const made = tasks.map((t) => insertTask(user.id, t));
      await page.reload();
      return made;
    });
  },
});

export { expect };
