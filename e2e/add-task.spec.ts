import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures.ts';

const NAME = 'Gọi cho anh Hải về hợp đồng';
const INK = 'rgb(30, 26, 21)';

const input = (page: Page) => page.getByRole('textbox', { name: 'Thêm việc' });
const date = (page: Page) => page.getByRole('textbox', { name: 'Ngày' });
const time = (page: Page) => page.getByRole('textbox', { name: 'Giờ' });
const add = (page: Page) => page.getByRole('button', { name: 'Thêm', exact: true });
const dueButton = (page: Page) => page.getByRole('button', { name: /^Hạn:/ });
const stored = async (page: Page) =>
  (await (await page.request.get('/api/tasks')).json()) as { title: string; dueAt: string | null }[];

test('C20 Enter and "Thêm" add the task; the field empties and keeps the cursor', async ({ page, signedIn }) => {
  expect(signedIn.email).toBeTruthy();
  await input(page).fill(NAME);
  await input(page).press('Enter');
  await expect(page.getByRole('listitem').filter({ hasText: NAME })).toHaveCount(1);
  await expect(input(page)).toHaveValue('');
  await expect(input(page)).toBeFocused();
  await input(page).fill('  Mua sữa  ');
  await add(page).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(input(page)).toHaveValue('');
  await expect(input(page)).toBeFocused();
  expect((await stored(page)).map((t) => [t.title, t.dueAt])).toEqual([[NAME, null], ['Mua sữa', null]]);
});

test('C20 pressing again while saving makes no duplicate', async ({ page, signedIn }) => {
  expect(signedIn.email).toBeTruthy();
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let posts = 0;
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    posts++;
    await held;
    await route.continue();
  });
  await input(page).fill(NAME);
  await input(page).press('Enter');
  await input(page).press('Enter');
  await add(page).click();
  release();
  await expect(input(page)).toHaveValue('');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  expect(posts).toBe(1);
});

test('C21 an invalid title adds nothing and shows the message under the bordered field', async ({ page, signedIn }) => {
  expect(signedIn.email).toBeTruthy();
  for (const [value, message] of [
    ['', 'Nhập tên việc'],
    ['    ', 'Nhập tên việc'],
    ['a'.repeat(201), 'Tên việc tối đa 200 ký tự'],
  ] as const) {
    await input(page).fill(value);
    await input(page).press('Enter');
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(input(page)).toHaveCSS('border-top-width', '2px');
    await expect(input(page)).toHaveCSS('border-top-color', INK);
    const field = (await input(page).boundingBox())!;
    const error = (await page.getByRole('alert').boundingBox())!;
    expect(error.y).toBeGreaterThanOrEqual(field.y + field.height);
    expect(error.y - (field.y + field.height)).toBeLessThan(20);
  }
  expect(await stored(page)).toEqual([]);
});

test('C22 the due button gives way to two fields; Esc closes them; adding stores that moment and resets', async ({ page, signedIn }) => {
  expect(signedIn.email).toBeTruthy();
  await expect(dueButton(page)).toHaveText('Hạn: chưa đặt');
  await dueButton(page).click();
  await expect(dueButton(page)).toHaveCount(0);
  await expect(date(page)).toBeFocused();
  const row = (await input(page).boundingBox())!;
  expect((await date(page).boundingBox())!.y).toBe(row.y);
  expect((await time(page).boundingBox())!.height).toBe(48);

  await date(page).fill('31/02/2026');
  await date(page).press('Escape');
  await expect(date(page)).toHaveCount(0);
  await expect(dueButton(page)).toHaveText('Hạn: chưa đặt');

  await dueButton(page).click();
  await date(page).fill('28/11/2026');
  await time(page).press('Escape');
  await expect(time(page)).toHaveCount(0);
  await expect(dueButton(page)).toHaveText('Hạn: 28/11 · 23:59');

  await dueButton(page).click();
  await time(page).fill('23:59');
  await input(page).fill(NAME);
  await add(page).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(date(page)).toHaveCount(0);
  await expect(dueButton(page)).toHaveText('Hạn: chưa đặt');
  // Asia/Ho_Chi_Minh is UTC+7.
  expect((await stored(page))[0]!.dueAt).toBe('2026-11-28T16:59:00.000Z');
  await dueButton(page).click();
  await expect(date(page)).toHaveValue('');
  await expect(time(page)).toHaveValue('');
});

test('C23 a bad due adds nothing and says why under the two fields', async ({ page, signedIn }) => {
  expect(signedIn.email).toBeTruthy();
  await input(page).fill(NAME);
  await dueButton(page).click();
  for (const [d, t, message] of [
    ['', '10:00', 'Chọn ngày cho hạn chót'],
    ['31/02/2026', '', 'Ngày giờ không hợp lệ'],
    ['28/11/2026', '25:00', 'Ngày giờ không hợp lệ'],
  ] as const) {
    await date(page).fill(d);
    await time(page).fill(t);
    await time(page).press('Enter');
    await expect(page.getByRole('alert')).toHaveText(message);
    const field = (await date(page).boundingBox())!;
    expect((await page.getByRole('alert').boundingBox())!.y).toBeGreaterThanOrEqual(field.y + field.height);
  }
  // Closed fields come back with the error.
  await time(page).press('Escape');
  await add(page).click();
  await expect(date(page)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('Ngày giờ không hợp lệ');
  expect(await stored(page)).toEqual([]);
});

for (const [width, height, placeholder] of [
  [1440, 1000, 'Thêm việc, ví dụ: Gọi cho anh Hải về hợp đồng'],
  [390, 844, 'Thêm việc…'],
] as const) {
  test.describe(`${width}`, () => {
    test.use({ viewport: { width, height } });

    test(`C26 the add form matches the prototype at ${width}`, async ({ page, signedIn }) => {
      expect(signedIn.email).toBeTruthy();
      await expect(input(page)).toHaveAttribute('placeholder', placeholder);
      await expect(input(page)).toHaveCSS('font-family', /Be Vietnam Pro/);
      await expect(add(page)).toHaveCSS('background-color', 'rgb(185, 58, 37)');
      await expect(add(page)).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(dueButton(page)).toHaveCSS('border-top-style', 'dashed');
      await expect(dueButton(page)).toHaveCSS('color', 'rgb(106, 98, 86)');

      const field = (await input(page).boundingBox())!;
      const submit = (await add(page).boundingBox())!;
      const due = (await dueButton(page).boundingBox())!;
      expect(submit.y).toBe(field.y);
      expect(submit.x).toBeGreaterThan(field.x + field.width);
      if (width === 390) expect(due.y).toBeGreaterThan(field.y + field.height);
      else expect(due.y).toBe(field.y);
      await page.screenshot({ path: `e2e/.tmp/add-${width}-list.png` });

      await input(page).fill(NAME);
      await dueButton(page).click();
      await date(page).fill('28/11/2026');
      await time(page).fill('23:59');
      await page.screenshot({ path: `e2e/.tmp/add-${width}-due.png` });

      await time(page).press('Escape');
      await expect(dueButton(page)).toHaveCSS('border-top-style', 'solid');
      await input(page).fill('');
      await add(page).click();
      await expect(page.getByRole('alert')).toHaveText('Nhập tên việc');
      await page.screenshot({ path: `e2e/.tmp/add-${width}-invalid.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });
  });
}
