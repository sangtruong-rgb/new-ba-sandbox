import { expect, test } from './support/fixtures.ts';

// Checks only what later tickets leave unchanged: the frame, its slots, the contracts.

const LIGHT = { bg: 'rgb(243, 238, 228)', paper: 'rgb(251, 248, 242)', muted: 'rgb(106, 98, 86)', accent: 'rgb(185, 58, 37)' };
const DARK = { bg: 'rgb(25, 22, 18)', paper: 'rgb(34, 30, 25)' };

const style = (loc: import('@playwright/test').Locator, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

test('C1 the server answers /api/health and serves the page at /', async ({ page, request, signedIn }) => {
  expect(signedIn.email).toContain('@');
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  await expect(page).toHaveTitle('Việc');
  await expect(page.getByRole('main')).toBeVisible();
});

test('C2 GET /api/tasks answers the signed-in user’s tasks, oldest first; without a session 401', async ({ page, request, signedIn, seedTasks }) => {
  expect(signedIn.password.length).toBeGreaterThanOrEqual(8);
  const made = await seedTasks(page, [
    { title: 'Nộp tờ khai thuế', createdAt: '2026-11-24T02:00:00.000Z', dueAt: '2026-11-28T16:59:00.000Z' },
    { title: 'Gia hạn hộ chiếu', createdAt: '2026-11-10T02:00:00.000Z', done: true },
  ]);
  expect(made).toHaveLength(2);
  expect(made[1]!.doneAt).toMatch(/Z$/);
  const res = await page.request.get('/api/tasks');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { title: string }[];
  expect(body.map((t) => t.title)).toEqual(['Gia hạn hộ chiếu', 'Nộp tờ khai thuế']);
  const anon = await request.get('/api/tasks');
  expect(anon.status()).toBe(401);
  expect(await anon.json()).toEqual({ error: 'unauthenticated' });
});

test('C8 signedIn opens the frame with every slot in place', async ({ page, signedIn }) => {
  expect(signedIn.email).toMatch(/@example\.com$/);
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('complementary')).toBeVisible();
  for (const name of ['rail', 'account', 'summary', 'input', 'list-empty', 'detail']) {
    await expect(page.locator(`[data-slot="${name}"]`).first()).toBeAttached();
  }
});

test('C6 rows draw their slots; a click selects the row; a done title is struck through in the muted colour', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: 'Họp review thiết kế màn đặt lịch' }, { title: 'Gia hạn hộ chiếu', done: true }]);
  const open = page.getByRole('listitem').filter({ hasText: 'Họp review thiết kế màn đặt lịch' });
  const done = page.getByRole('listitem').filter({ hasText: 'Gia hạn hộ chiếu' });
  for (const name of ['item-time', 'item-lead', 'item-sub']) await expect(open.locator(`[data-slot="${name}"]`)).toBeAttached();
  const title = done.getByText('Gia hạn hộ chiếu', { exact: true });
  expect(await style(title, 'text-decoration-line')).toContain('line-through');
  expect(await style(title, 'color')).toBe(LIGHT.muted);
  await open.getByText('Họp review thiết kế màn đặt lịch', { exact: true }).click();
  await expect(open).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-slot="detail-actions"]')).toBeAttached();
});

test('C6 a group with tone alert shows its title and count in the accent colour', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: 'Gửi báo giá cho khách Phú Mỹ' }, { title: 'Đóng tiền internet tháng 11' }]);
  await page.evaluate(async () => {
    const url = '/web/list.ts';
    const list = await import(/* @vite-ignore */ url);
    list.setListArrangement((tasks: unknown[]) => [{ id: 'over', title: 'Quá hạn', tone: 'alert', tasks }]);
  });
  const heading = page.getByRole('heading', { level: 2, name: /Quá hạn/ });
  await expect(heading).toHaveText('Quá hạn2');
  expect(await style(heading, 'color')).toBe(LIGHT.accent);
});

test.describe('1440', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('C10 three columns: rail 248, list, detail 360; colours and fonts of the prototype', async ({ page, signedIn }) => {
    expect(signedIn.email).toBeTruthy();
    const rail = await page.getByRole('navigation').boundingBox();
    const main = await page.getByRole('main').boundingBox();
    const pane = await page.getByRole('complementary').boundingBox();
    expect(rail).toMatchObject({ x: 0, width: 248 });
    expect(main!.x).toBe(248);
    expect(pane!.width).toBe(360);
    expect(pane!.x + pane!.width).toBe(1440);
    await expect(page.getByRole('navigation').getByText('Việc.')).toBeVisible();
    expect(await style(page.locator('body'), 'background-color')).toBe(LIGHT.bg);
    expect(await style(page.getByRole('complementary'), 'background-color')).toBe(LIGHT.paper);
    expect(await style(page.getByRole('navigation').getByText('Việc.'), 'font-family')).toContain('Fraunces');
    expect(await style(page.locator('body'), 'font-family')).toContain('Be Vietnam Pro');
    const loaded = await page.evaluate(async () => {
      await document.fonts.load('600 22px Fraunces', 'Việc');
      await document.fonts.load('400 15px "Be Vietnam Pro"', 'Việc');
      await document.fonts.load('600 15px "Be Vietnam Pro"', 'Việc');
      return [...document.fonts]
        .filter((f) => f.status === 'loaded')
        .map((f) => `${f.family.replace(/"/g, '')} ${f.weight}`);
    });
    expect(loaded).toEqual(expect.arrayContaining(['Fraunces 600', 'Be Vietnam Pro 400', 'Be Vietnam Pro 600']));
  });

  test('C10 the dark theme follows the system', async ({ page, signedIn }) => {
    expect(signedIn.email).toBeTruthy();
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await style(page.locator('body'), 'background-color')).toBe(DARK.bg);
    expect(await style(page.getByRole('complementary'), 'background-color')).toBe(DARK.paper);
  });

  test('C7 item-time shows and item-sub hides; selecting keeps the list beside the detail', async ({ page, signedIn, seedTasks }) => {
    expect(signedIn.email).toBeTruthy();
    await seedTasks(page, [{ title: 'Mua thuốc dị ứng cho mẹ' }]);
    const row = page.getByRole('listitem').first();
    expect(await style(row.locator('[data-slot="item-time"]'), 'display')).not.toBe('none');
    expect(await style(row.locator('[data-slot="item-sub"]'), 'display')).toBe('none');
    await row.getByText('Mua thuốc dị ứng cho mẹ').click();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('complementary')).toBeVisible();
    await expect(page.getByRole('button', { name: '‹ Danh sách' })).toBeHidden();
  });
});

test.describe('1000', () => {
  test.use({ viewport: { width: 1000, height: 900 } });

  test('C7 below 1100 the detail replaces the list while a task is selected', async ({ page, signedIn, seedTasks }) => {
    expect(signedIn.email).toBeTruthy();
    await seedTasks(page, [{ title: 'Đổi lịch khám răng sang tuần sau' }]);
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('complementary')).toBeHidden();
    await page.getByText('Đổi lịch khám răng sang tuần sau').click();
    await expect(page.getByRole('main')).toBeHidden();
    await expect(page.getByRole('complementary')).toBeVisible();
    await expect(page.locator('[data-slot="detail-actions"]')).toBeAttached();
    await page.getByRole('button', { name: '‹ Danh sách' }).click();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('complementary')).toBeHidden();
    await expect(page.getByRole('listitem').first()).toHaveAttribute('aria-selected', 'false');
  });
});

test.describe('390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('C10 the rail becomes a top bar with the brand and the account slot', async ({ page, signedIn }) => {
    expect(signedIn.email).toBeTruthy();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const main = page.getByRole('main');
    await expect(main.getByText('Việc.')).toBeVisible();
    await expect(main.locator('[data-slot="account"]')).toBeAttached();
    await expect(main.locator('[data-slot="rail"]')).toBeAttached();
    const order = await main.evaluate((el) =>
      Array.from(el.querySelectorAll('[data-slot="summary"],[data-slot="rail"],[data-slot="input"]')).map((n) => n.getAttribute('data-slot')),
    );
    expect(order).toEqual(['summary', 'rail', 'input']);
    expect((await main.boundingBox())!.width).toBe(390);
  });

  test('C7 item-sub shows and item-time hides; the selected task fills the screen under "‹ Danh sách"', async ({ page, signedIn, seedTasks }) => {
    expect(signedIn.email).toBeTruthy();
    await seedTasks(page, [{ title: 'Họp review thiết kế màn đặt lịch' }]);
    const row = page.getByRole('listitem').first();
    expect(await style(row.locator('[data-slot="item-time"]'), 'display')).toBe('none');
    expect(await style(row.locator('[data-slot="item-sub"]'), 'display')).not.toBe('none');
    await expect(page.getByRole('complementary')).toBeHidden();
    await row.getByText('Họp review thiết kế màn đặt lịch').click();
    await expect(page.getByRole('main')).toBeHidden();
    const back = page.getByRole('button', { name: '‹ Danh sách' });
    await expect(back).toBeVisible();
    expect((await page.getByRole('complementary').boundingBox())!.width).toBe(390);
  });
});
