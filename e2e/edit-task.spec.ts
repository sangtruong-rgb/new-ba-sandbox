import type { Locator, Page } from '@playwright/test';
import { expect, test } from './support/fixtures.ts';

const TITLE = 'Họp review thiết kế màn đặt lịch';
const OTHER = 'Mua thuốc dị ứng cho mẹ';
// 15:30 on 28/11/2026 in Asia/Ho_Chi_Minh, the browser's time zone.
const DUE = '2026-11-28T08:30:00.000Z';

const LIGHT = { ink: 'rgb(30, 26, 21)', muted: 'rgb(106, 98, 86)', line: 'rgb(221, 211, 195)' };
const DARK = { ink: 'rgb(239, 232, 220)', line: 'rgb(58, 51, 42)' };

const style = (loc: Locator, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

const row = (page: Page, title: string) => page.getByRole('listitem').filter({ hasText: title });
const select = (page: Page, title: string) => row(page, title).getByText(title, { exact: true }).click();
const detail = (page: Page) => page.locator('[data-slot="detail"]');
const name = (page: Page) => page.getByRole('textbox', { name: 'Tên việc' });
const date = (page: Page) => page.getByRole('textbox', { name: 'Ngày hạn chót' });
const time = (page: Page) => page.getByRole('textbox', { name: 'Giờ hạn chót' });
const button = (page: Page, text: string) => page.getByRole('button', { name: text, exact: true });
const alert = (page: Page) => detail(page).getByRole('alert');

/** The tasks as the server has them. */
const stored = async (page: Page) =>
  ((await (await page.request.get('/api/tasks')).json()) as { title: string; dueAt: string | null }[]).map(
    ({ title, dueAt }) => ({ title, dueAt }),
  );

/** Records every PATCH the page sends. */
function patches(page: Page) {
  const sent: unknown[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH') sent.push(r.postDataJSON());
  });
  return sent;
}

test('C46 the pane asks to pick a task, and is empty without tasks', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await expect(page.locator('[data-slot="list-empty"]')).toBeAttached();
  await expect(detail(page)).toBeEmpty();
  await seedTasks(page, [{ title: TITLE }]);
  await expect(detail(page)).toHaveText('Chọn một việc để xem và sửa');
});

test('C47 a selected task shows its name, due fields and "Bỏ hạn"', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: TITLE, dueAt: DUE }, { title: OTHER }]);
  await select(page, TITLE);
  await expect(name(page)).toHaveValue(TITLE);
  expect(await style(name(page), 'font-family')).toContain('Fraunces');
  expect(await style(name(page), 'font-size')).toBe('22px');
  expect(await style(name(page), 'border-top-width')).toBe('0px');
  expect(await style(name(page), 'border-bottom-width')).toBe('1px');
  await name(page).focus();
  expect(await style(name(page), 'border-bottom-width')).toBe('2px');
  await expect(detail(page).getByText('Hạn chót', { exact: true })).toBeVisible();
  await expect(date(page)).toHaveValue('28/11/2026');
  await expect(time(page)).toHaveValue('15:30');
  await expect(button(page, 'Bỏ hạn')).toBeVisible();

  await select(page, OTHER);
  await expect(name(page)).toHaveValue(OTHER);
  await expect(date(page)).toHaveValue('');
  await expect(time(page)).toHaveValue('');
  await expect(button(page, 'Bỏ hạn')).toHaveCount(0);
});

test('C48 Enter or leaving the field saves the name, Escape restores it', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: TITLE }]);
  const sent = patches(page);
  await select(page, TITLE);

  await name(page).fill('Tên sau Enter');
  await name(page).press('Enter');
  await expect(row(page, 'Tên sau Enter')).toBeVisible();

  await name(page).fill('Tên sau khi rời ô');
  await name(page).blur();
  await expect(row(page, 'Tên sau khi rời ô')).toBeVisible();

  await name(page).fill('Bỏ đi');
  await name(page).press('Escape');
  await expect(name(page)).toHaveValue('Tên sau khi rời ô');
  await name(page).blur();
  await page.reload();
  await expect(row(page, 'Tên sau khi rời ô')).toBeVisible();
  expect(sent).toEqual([{ title: 'Tên sau Enter' }, { title: 'Tên sau khi rời ô' }]);
});

test('C49 an invalid name is kept with its message and not saved; a valid one is trimmed', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: TITLE }]);
  const sent = patches(page);
  await select(page, TITLE);

  for (const [typed, message] of [
    ['   ', 'Nhập tên việc'],
    ['a'.repeat(201), 'Tên việc tối đa 200 ký tự'],
  ] as const) {
    await name(page).fill(typed);
    await name(page).press('Enter');
    await expect(alert(page)).toHaveText(message);
    await name(page).blur();
    await expect(name(page)).toHaveValue(typed);
    expect(await style(name(page), 'border-bottom-width')).toBe('2px');
    expect(await style(name(page), 'border-bottom-color')).toBe(LIGHT.ink);
    const field = (await name(page).boundingBox())!;
    const error = (await alert(page).boundingBox())!;
    expect(error.y).toBeGreaterThanOrEqual(field.y + field.height);
    expect(error.y - (field.y + field.height)).toBeLessThan(16);
  }
  expect(sent).toEqual([]);

  await name(page).fill('  Tên gọn  ');
  await name(page).press('Enter');
  await expect(name(page)).toHaveValue('Tên gọn');
  await expect(alert(page)).toHaveCount(0);
  expect(await stored(page)).toEqual([{ title: 'Tên gọn', dueAt: null }]);
});

test('C50 the due time is saved on leaving both fields, errors are not, "Bỏ hạn" clears it', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: TITLE }]);
  const sent = patches(page);
  await select(page, TITLE);

  await date(page).fill('28/11/2026');
  await time(page).click();
  await time(page).fill('15:30');
  expect(sent).toEqual([]);
  await time(page).blur();
  await expect(button(page, 'Bỏ hạn')).toBeVisible();
  expect(await stored(page)).toEqual([{ title: TITLE, dueAt: DUE }]);

  await time(page).fill('');
  await time(page).blur();
  await expect(time(page)).toHaveValue('23:59');

  for (const [d, t, message] of [
    ['31/02/2026', '10:00', 'Ngày giờ không hợp lệ'],
    ['', '10:00', 'Chọn ngày cho hạn chót'],
  ] as const) {
    await date(page).fill(d);
    await time(page).fill(t);
    await time(page).blur();
    await expect(alert(page)).toHaveText(message);
    const field = (await date(page).boundingBox())!;
    expect((await alert(page).boundingBox())!.y).toBeGreaterThanOrEqual(field.y + field.height);
    await expect(date(page)).toHaveValue(d);
  }
  expect(await stored(page)).toEqual([{ title: TITLE, dueAt: '2026-11-28T16:59:00.000Z' }]);

  await button(page, 'Bỏ hạn').click();
  await expect(button(page, 'Bỏ hạn')).toHaveCount(0);
  await expect(date(page)).toHaveValue('');
  await expect(time(page)).toHaveValue('');
  await expect(alert(page)).toHaveCount(0);
  expect(await stored(page)).toEqual([{ title: TITLE, dueAt: null }]);
});

test('C51 picking another task saves a valid edit and drops an invalid one', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: TITLE }, { title: OTHER }]);
  await select(page, TITLE);
  await name(page).fill('Tên đã sửa');
  await select(page, OTHER);
  await expect(name(page)).toHaveValue(OTHER);
  await expect(row(page, 'Tên đã sửa')).toBeVisible();

  await date(page).fill('28/11/2026');
  await time(page).fill('15:30');
  await select(page, 'Tên đã sửa');
  await expect(name(page)).toHaveValue('Tên đã sửa');
  await expect.poll(() => stored(page)).toEqual([
    { title: 'Tên đã sửa', dueAt: null },
    { title: OTHER, dueAt: DUE },
  ]);

  await name(page).fill('');
  await select(page, OTHER);
  await expect(name(page)).toHaveValue(OTHER);
  await expect(alert(page)).toHaveCount(0);
  await date(page).fill('sai');
  await select(page, 'Tên đã sửa');
  await expect(name(page)).toHaveValue('Tên đã sửa');
  await select(page, OTHER);
  await expect(date(page)).toHaveValue('28/11/2026');
});

// A held button lets the field's blur take effect before the click lands.
for (const [label, typed, expected] of [
  ['a valid', 'Tên đã sửa', 'Tên đã sửa'],
  ['an invalid', '', TITLE],
] as const) {
  test(`C51 "Xóa việc" during ${label} edit still deletes, saving only a valid one first`, async ({ page, signedIn, seedTasks }) => {
    expect(signedIn.email).toBeTruthy();
    await seedTasks(page, [{ title: TITLE }, { title: OTHER }]);
    const calls: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET') calls.push(`${r.method()} ${r.postData() ?? ''}`.trim());
    });
    await select(page, TITLE);
    await name(page).fill(typed);
    await button(page, 'Xóa việc').click({ delay: 300 });
    await expect(row(page, OTHER)).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(1);
    expect(calls).toEqual(
      typed ? [`PATCH ${JSON.stringify({ title: expected })}`, 'DELETE'] : ['DELETE'],
    );
  });
}

test.describe('390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('C51 "‹ Danh sách" saves a valid edit and drops an invalid one', async ({ page, signedIn, seedTasks }) => {
    expect(signedIn.email).toBeTruthy();
    await seedTasks(page, [{ title: TITLE }]);
    await select(page, TITLE);
    await name(page).fill('Tên đã sửa');
    await button(page, '‹ Danh sách').click();
    await expect(row(page, 'Tên đã sửa')).toBeVisible();

    await select(page, 'Tên đã sửa');
    await name(page).fill('');
    await button(page, '‹ Danh sách').click();
    await expect(row(page, 'Tên đã sửa')).toBeVisible();
    await select(page, 'Tên đã sửa');
    await expect(name(page)).toHaveValue('Tên đã sửa');
  });
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width} look`, () => {
    test.use({ viewport });

    test(`C53 ${viewport.width}: the detail slot looks as in the prototype`, async ({ page, signedIn, seedTasks }) => {
      expect(signedIn.email).toBeTruthy();
      await seedTasks(page, [{ title: TITLE, dueAt: DUE }]);

      if (viewport.width === 1440) {
        const none = detail(page).getByText('Chọn một việc để xem và sửa');
        expect(await style(none, 'color')).toBe(LIGHT.muted);
        expect(await style(none, 'margin-top')).toBe('40px');
        await page.screenshot({ path: `e2e/.tmp/edit-list-${viewport.width}.png` });
      } else {
        await expect(detail(page)).toBeHidden();
      }

      await select(page, TITLE);
      expect(await style(name(page), 'font-weight')).toBe('600');
      expect(await style(name(page), 'background-color')).toBe('rgba(0, 0, 0, 0)');
      expect(await style(name(page), 'border-bottom-color')).toBe(LIGHT.line);
      const title = (await name(page).boundingBox())!;
      const slot = (await detail(page).boundingBox())!;
      expect(title.width).toBeCloseTo(slot.width, 0);
      const label = detail(page).getByText('Hạn chót', { exact: true });
      const labelAt = (await label.boundingBox())!;
      const dateAt = (await date(page).boundingBox())!;
      const timeAt = (await time(page).boundingBox())!;
      const clear = button(page, 'Bỏ hạn');
      const clearAt = (await clear.boundingBox())!;
      expect(labelAt.y).toBeGreaterThan(title.y + title.height);
      expect(dateAt.y).toBeGreaterThan(labelAt.y);
      expect(timeAt.y).toBe(dateAt.y);
      expect(timeAt.width).toBeCloseTo(dateAt.width, 0);
      expect(clearAt.y).toBeGreaterThan(dateAt.y + dateAt.height);
      expect(await style(clear, 'text-decoration-line')).toBe('underline');
      expect(await style(clear, 'font-size')).toBe('14px');
      expect(await style(clear, 'color')).toBe(LIGHT.ink);
      await page.screenshot({ path: `e2e/.tmp/edit-task-${viewport.width}.png` });

      await name(page).fill('');
      await name(page).press('Enter');
      await name(page).blur();
      await expect(alert(page)).toHaveText('Nhập tên việc');
      await expect(name(page)).toHaveAttribute('placeholder', 'Tên việc');
      expect(await style(alert(page), 'font-size')).toBe('13px');
      expect(await style(alert(page), 'font-weight')).toBe('600');
      expect(await style(alert(page), 'color')).toBe(LIGHT.ink);
      expect(await style(name(page), 'border-bottom-color')).toBe(LIGHT.ink);
      await page.screenshot({ path: `e2e/.tmp/edit-invalid-${viewport.width}.png` });

      await page.emulateMedia({ colorScheme: 'dark' });
      expect(await style(alert(page), 'color')).toBe(DARK.ink);
      expect(await style(name(page), 'border-bottom-color')).toBe(DARK.ink);
    });
  });
}
