import type { Locator, Page } from '@playwright/test';
import { SESSION_COOKIE, SessionStore } from '../server/auth/sessions.ts';
import { expect, test } from './support/fixtures.ts';

const TITLE = 'Họp review thiết kế màn đặt lịch';
const OTHER = 'Mua thuốc dị ứng cho mẹ';

const LIGHT = { ink: 'rgb(30, 26, 21)', muted: 'rgb(106, 98, 86)', accentInk: 'rgb(255, 255, 255)' };
const DARK = { ink: 'rgb(239, 232, 220)', muted: 'rgb(173, 163, 147)' };

const style = (loc: Locator, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

const row = (page: Page, title: string) => page.getByRole('listitem').filter({ hasText: title });
const box = (page: Page, title: string) => page.getByRole('checkbox', { name: `Đánh dấu xong: ${title}` });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const select = (page: Page, title: string) => row(page, title).getByText(title, { exact: true }).click();

test('C27 the box ticks and unticks a task without selecting its row', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: TITLE }]);
  const title = row(page, TITLE).getByText(TITLE, { exact: true });
  await expect(box(page, TITLE)).toHaveAttribute('aria-checked', 'false');

  await box(page, TITLE).click();
  await expect(box(page, TITLE)).toHaveAttribute('aria-checked', 'true');
  await expect(box(page, TITLE).locator('svg')).toBeVisible();
  expect(await style(title, 'text-decoration-line')).toContain('line-through');
  expect(await style(title, 'color')).toBe(LIGHT.muted);
  await expect(row(page, TITLE)).toHaveAttribute('aria-selected', 'false');

  await box(page, TITLE).click();
  await expect(box(page, TITLE)).toHaveAttribute('aria-checked', 'false');
  await expect(box(page, TITLE).locator('svg')).toHaveCount(0);
  expect(await style(title, 'text-decoration-line')).toBe('none');
  await expect(row(page, TITLE)).toHaveAttribute('aria-selected', 'false');
});

test('C28 done survives a reload and shows in another browser of the same account', async ({ page, browser, baseURL, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: TITLE }]);
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT');
  await box(page, TITLE).click();
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(box(page, TITLE)).toHaveAttribute('aria-checked', 'true');

  const sid = (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE)!;
  const { token } = SessionStore.create(SessionStore.findUser(sid.value)!.id);
  const second = await browser.newContext({ baseURL });
  await second.addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL! }]);
  const otherPage = await second.newPage();
  await otherPage.goto('/');
  await expect(box(otherPage, TITLE)).toHaveAttribute('aria-checked', 'true');
  await second.close();
});

test('C29 the action button marks the selected task done and back', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: TITLE }]);
  await select(page, TITLE);

  await button(page, 'Đánh dấu xong').click();
  await expect(box(page, TITLE)).toHaveAttribute('aria-checked', 'true');
  await expect(button(page, 'Bỏ đánh dấu xong')).toBeVisible();
  await expect(button(page, 'Đánh dấu xong')).toHaveCount(0);
  expect(await style(row(page, TITLE).getByText(TITLE, { exact: true }), 'text-decoration-line')).toContain('line-through');

  await button(page, 'Bỏ đánh dấu xong').click();
  await expect(box(page, TITLE)).toHaveAttribute('aria-checked', 'false');
  await expect(button(page, 'Đánh dấu xong')).toBeVisible();
});

test('C30 "Xóa việc" removes the task at once, clears the selection and it stays gone', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: TITLE }, { title: OTHER }]);
  let dialogs = 0;
  page.on('dialog', (d) => {
    dialogs++;
    void d.dismiss();
  });
  await select(page, TITLE);
  await button(page, 'Xóa việc').click();

  await expect(row(page, TITLE)).toHaveCount(0);
  await expect(row(page, OTHER)).toHaveAttribute('aria-selected', 'false');
  await expect(button(page, 'Xóa việc')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /hoàn tác/i })).toHaveCount(0);
  expect(dialogs).toBe(0);

  await page.reload();
  await expect(row(page, OTHER)).toBeVisible();
  await expect(row(page, TITLE)).toHaveCount(0);
});

test('C30 a delete the server fails keeps the task and shows the connection error', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: TITLE }]);
  await page.route('**/api/tasks/*', (r) => r.fulfill({ status: 500, json: { error: 'server_error' } }));
  await select(page, TITLE);
  await button(page, 'Xóa việc').click();
  await expect(page.getByRole('alert')).toHaveText('Không kết nối được máy chủ. Thử lại sau.');
  await expect(row(page, TITLE)).toHaveAttribute('aria-selected', 'true');
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}`, () => {
    test.use({ viewport });

    test(`C32 ${viewport.width}: the box and the action row look as in the prototype`, async ({ page, signedIn, seedTasks }) => {
      expect(signedIn.email).toBeTruthy();
      await seedTasks(page, [{ title: TITLE }, { title: OTHER, done: true }]);

      const open = box(page, TITLE);
      expect(await open.boundingBox()).toMatchObject({ width: 20, height: 20 });
      expect(await style(open, 'border-top-color')).toBe(LIGHT.ink);
      expect(await style(open, 'border-top-left-radius')).toBe('3px');
      expect(await style(open, 'background-color')).toBe('rgba(0, 0, 0, 0)');
      const done = box(page, OTHER);
      expect(await style(done, 'background-color')).toBe(LIGHT.muted);
      expect(await style(done, 'border-top-color')).toBe(LIGHT.muted);
      expect(await style(done, 'color')).toBe(LIGHT.accentInk);
      const boxAt = (await open.boundingBox())!;
      const titleAt = (await row(page, TITLE).getByText(TITLE, { exact: true }).boundingBox())!;
      expect(boxAt.x + boxAt.width).toBeLessThan(titleAt.x);
      expect(Math.abs(boxAt.y + boxAt.height / 2 - (titleAt.y + 11))).toBeLessThanOrEqual(3);

      await select(page, TITLE);
      const actions = page.locator('[data-slot="detail-actions"]');
      await expect(actions.getByRole('button')).toHaveText(['Đánh dấu xong', 'Xóa việc']);
      const mark = button(page, 'Đánh dấu xong');
      const del = button(page, 'Xóa việc');
      for (const link of [mark, del]) {
        expect(await style(link, 'text-decoration-line')).toBe('underline');
        expect(await style(link, 'background-color')).toBe('rgba(0, 0, 0, 0)');
        expect(await style(link, 'border-top-width')).toBe('0px');
        expect(await style(link, 'font-size')).toBe('14px');
        expect(await style(link, 'font-family')).toContain('Be Vietnam Pro');
      }
      expect(await style(mark, 'color')).toBe(LIGHT.ink);
      expect(await style(del, 'color')).toBe(LIGHT.muted);
      expect((await del.boundingBox())!.y).toBe((await mark.boundingBox())!.y);

      await page.emulateMedia({ colorScheme: 'dark' });
      expect(await style(mark, 'color')).toBe(DARK.ink);
      expect(await style(del, 'color')).toBe(DARK.muted);
    });
  });
}
