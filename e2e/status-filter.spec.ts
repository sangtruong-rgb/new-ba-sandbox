import type { Locator, Page } from '@playwright/test';
import { hashPassword } from '../server/auth/password.ts';
import { SESSION_COOKIE, SessionStore } from '../server/auth/sessions.ts';
import { UserStore } from '../server/auth/users.ts';
import { expect, test } from './support/fixtures.ts';

const OPEN = 'Họp review thiết kế màn đặt lịch';
const DONE = 'Mua thuốc dị ứng cho mẹ';
const TASKS = [{ title: OPEN }, { title: DONE, done: true }, { title: 'Gửi báo giá cho anh Hải' }];

const LIGHT = {
  paper: 'rgb(251, 248, 242)',
  bg: 'rgb(243, 238, 228)',
  ink: 'rgb(30, 26, 21)',
  muted: 'rgb(106, 98, 86)',
  line: 'rgb(221, 211, 195)',
};

const style = (loc: Locator, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

const rail = (page: Page) => page.locator('[data-slot="rail"]');
const filter = (page: Page, label: string) => rail(page).getByRole('button', { name: new RegExp(`^${label} \\d+$`) });
const rows = (page: Page) => page.getByRole('listitem');
const empty = (page: Page) => page.locator('[data-slot="list-empty"]');

test('C41 each choice shows only its tasks', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, TASKS);
  await filter(page, 'Chưa xong').click();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).filter({ hasText: DONE })).toHaveCount(0);
  await filter(page, 'Đã xong').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText(DONE);
  await filter(page, 'Tất cả').click();
  await expect(rows(page)).toHaveCount(3);
});

test('C42 counts change as soon as a task is ticked, without a page reload', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, TASKS);
  await expect(rail(page).getByRole('button')).toHaveText(['Tất cả 3', 'Chưa xong 2', 'Đã xong 1']);
  await page.evaluate(() => ((window as any).__same = true));
  await page.getByRole('checkbox', { name: `Đánh dấu xong: ${OPEN}` }).click();
  await expect(rail(page).getByRole('button')).toHaveText(['Tất cả 3', 'Chưa xong 1', 'Đã xong 2']);
  expect(await page.evaluate(() => (window as any).__same)).toBe(true);
});

test('C43 the choice survives a reload and another account in the same browser', async ({ page, baseURL, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, TASKS);
  await filter(page, 'Đã xong').click();
  expect(await page.evaluate(() => localStorage.getItem('todo.filter'))).toBe('done');
  await page.reload();
  await expect(filter(page, 'Đã xong')).toHaveAttribute('aria-current', 'page');
  await expect(rows(page)).toHaveCount(1);

  const other = UserStore.create(`other-${Date.now()}@example.com`, await hashPassword('mat-khau-rat-dai'));
  const { token } = SessionStore.create(other.id);
  await page.context().clearCookies();
  await page.context().addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL! }]);
  await page.reload();
  await expect(filter(page, 'Đã xong')).toHaveAttribute('aria-current', 'page');
  await expect(filter(page, 'Tất cả')).toHaveText('Tất cả 0');
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  const wide = viewport.width === 1440;
  test.describe(`${viewport.width}`, () => {
    test.use({ viewport });

    test(`C40 ${viewport.width}: three filters with counts, "Tất cả" current`, async ({ page, signedIn, seedTasks }) => {
      expect(signedIn.email).toBeTruthy();
      await seedTasks(page, TASKS);
      await expect(rail(page).getByRole('button')).toHaveText(['Tất cả 3', 'Chưa xong 2', 'Đã xong 1']);
      await expect(filter(page, 'Tất cả')).toHaveAttribute('aria-current', 'page');
      await expect(rail(page).locator('[aria-current]')).toHaveCount(1);
      const railAt = (await rail(page).boundingBox())!;
      const inputAt = (await page.locator('[data-slot="input"]').boundingBox())!;
      if (wide) expect(railAt.x + railAt.width).toBeLessThanOrEqual(248);
      else expect(railAt.y + railAt.height).toBeLessThanOrEqual(inputAt.y);
    });

    test(`C44 ${viewport.width}: the empty list says why`, async ({ page, signedIn, seedTasks }) => {
      expect(signedIn.email).toBeTruthy();
      await expect(empty(page)).toHaveText('Viết việc đầu tiên vào ô phía trên.');
      await seedTasks(page, [{ title: DONE, done: true }]);
      await filter(page, 'Chưa xong').click();
      await expect(empty(page)).toHaveText('Không còn việc nào chưa xong.');
      await seedTasks(page, []);
      await filter(page, 'Đã xong').click();
      await expect(rows(page)).toHaveCount(1);

      await page.getByRole('checkbox').click();
      await expect(empty(page)).toHaveText('Chưa có việc nào xong.');
    });

    test(`C45 ${viewport.width}: filters and empty line look as in the prototype`, async ({ page, signedIn, seedTasks }) => {
      expect(signedIn.email).toBeTruthy();
      await seedTasks(page, [{ title: OPEN }]);
      const all = filter(page, 'Tất cả');
      const done = filter(page, 'Đã xong');
      const boxes = await Promise.all(
        (await rail(page).getByRole('button').all()).map(async (b) => (await b.boundingBox())!),
      );
      expect(await style(all, 'font-family')).toContain('Be Vietnam Pro');
      expect(await style(all, 'color')).toBe(wide ? LIGHT.ink : LIGHT.bg);
      expect(await style(done, 'color')).toBe(LIGHT.ink);
      const count = all.locator('b');
      if (wide) {
        expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
        expect(boxes[1]!.x).toBe(boxes[0]!.x);
        expect(await style(all, 'background-color')).toBe(LIGHT.paper);
        expect(await style(all, 'box-shadow')).toContain('inset');
        expect(await style(done, 'background-color')).toBe('rgba(0, 0, 0, 0)');
        expect(await style(done, 'border-top-width')).toBe('0px');
        expect(await style(count, 'font-family')).toContain('Fraunces');
        expect(await style(count, 'font-size')).toBe('20px');
        const countAt = (await count.boundingBox())!;
        expect(Math.round(countAt.x + countAt.width)).toBe(Math.round(boxes[0]!.x + boxes[0]!.width - 10));
      } else {
        expect(boxes[1]!.y).toBe(boxes[0]!.y);
        expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.width);
        expect(boxes[0]!.height).toBeGreaterThanOrEqual(36);
        expect(await style(all, 'background-color')).toBe(LIGHT.ink);
        expect(await style(done, 'border-top-color')).toBe(LIGHT.line);
        expect(await style(done, 'border-top-left-radius')).toBe('999px');
        expect(await style(count, 'font-size')).toBe('14px');
        expect(await style(count, 'font-family')).toContain('Be Vietnam Pro');
      }
      await page.screenshot({ path: `e2e/.tmp/filter-list-${viewport.width}.png` });

      await done.click();
      const line = empty(page).getByText('Chưa có việc nào xong.');
      expect(await style(line, 'color')).toBe(LIGHT.muted);
      expect(await style(line, 'padding-top')).toBe('28px');
      expect(await style(line, 'border-top-color')).toBe(LIGHT.line);
      expect(await style(line, 'border-top-width')).toBe('1px');
      await page.screenshot({ path: `e2e/.tmp/filter-empty-${viewport.width}.png` });
    });
  });
}
