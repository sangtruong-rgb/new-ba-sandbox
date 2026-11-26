import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { SESSION_COOKIE } from '../server/auth/sessions.ts';
import { expect, test } from './support/fixtures.ts';

const LIGHT = { bg: 'rgb(243, 238, 228)', paper: 'rgb(251, 248, 242)', ink: 'rgb(30, 26, 21)', muted: 'rgb(106, 98, 86)', accent: 'rgb(185, 58, 37)', white: 'rgb(255, 255, 255)', line: 'rgb(221, 211, 195)' };
const DARK = { bg: 'rgb(25, 22, 18)', paper: 'rgb(34, 30, 25)', ink: 'rgb(239, 232, 220)', accent: 'rgb(239, 122, 92)' };
const ENDED = 'Phiên đăng nhập đã hết, hãy đăng nhập lại.';

const style = (loc: Locator, prop: string) => loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const newEmail = () => `user-${randomUUID()}@example.com`;

const email = (page: Page) => page.getByLabel('Email');
const password = (page: Page) => page.getByLabel('Mật khẩu');

async function signUp(page: Page, address: string, pass = 'mat-khau-rat-dai') {
  await page.getByRole('link', { name: 'Tạo tài khoản' }).click();
  await email(page).fill(address);
  await password(page).fill(pass);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
}

async function signIn(page: Page, address: string, pass: string) {
  await email(page).fill(address);
  await password(page).fill(pass);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test('C11 signed out, / shows only the "Đăng nhập" screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible();
  await expect(email(page)).toBeVisible();
  await expect(password(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tạo tài khoản' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(0);
  await expect(page.locator('[data-slot="input"]')).toHaveCount(0);
  await expect(page.getByText(ENDED)).toHaveCount(0);
});

test('C12 creating an account signs in and shows the user’s empty list', async ({ page }) => {
  const address = newEmail();
  await page.goto('/');
  await signUp(page, address);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('navigation').getByText(address)).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(0);
  const me = await page.request.get('/api/me');
  expect(await me.json()).toEqual({ id: expect.any(String), email: address });
  expect(await (await page.request.get('/api/tasks')).json()).toEqual([]);
});

test('C13 sign-up errors: one at a time, in order, under the field with a 2px ink border; no account made', async ({ page, request }) => {
  const address = newEmail();
  await page.goto('/');
  await page.getByRole('link', { name: 'Tạo tài khoản' }).click();
  await email(page).fill('minhthu@example');
  await password(page).fill('123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email không hợp lệ');
  await expect(page.getByRole('alert')).toHaveCount(1);
  expect(await style(email(page), 'border-top-width')).toBe('2px');
  expect(await style(email(page), 'border-top-color')).toBe(LIGHT.ink);
  const errBox = (await page.getByRole('alert').boundingBox())!;
  const emailBox = (await email(page).boundingBox())!;
  expect(errBox.y).toBeGreaterThanOrEqual(emailBox.y + emailBox.height);
  expect(errBox.y).toBeLessThan(emailBox.y + emailBox.height + 12);

  await email(page).fill(address);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('alert')).toHaveText('Mật khẩu cần ít nhất 8 ký tự');
  expect(await style(password(page), 'border-top-width')).toBe('2px');
  expect(await style(email(page), 'border-top-width')).toBe('1px');

  // Nothing was made: the address can still sign up.
  const fresh = await request.post('/api/account/signup', { data: { email: address.toUpperCase(), password: 'mat-khau-1' } });
  expect(fresh.status()).toBe(201);

  await password(page).fill('mat-khau-khac-1');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toHaveText('Email này đã có tài khoản · Đăng nhập');
  expect(await style(email(page), 'border-top-width')).toBe('2px');
  await expect(page.getByRole('main')).toHaveCount(0);
  await alert.getByRole('link', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible();
  // The first password still works: the second attempt made nothing.
  await signIn(page, address, 'mat-khau-1');
  await expect(page.getByRole('main')).toBeVisible();
});

test('C14 the right email in any case signs in; a wrong email or password say the same', async ({ page, signedIn, context }) => {
  await context.clearCookies();
  await page.goto('/');
  await signIn(page, signedIn.email, 'sai-mat-khau-1');
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng');
  await expect(page.getByText(ENDED)).toHaveCount(0);
  await signIn(page, newEmail(), signedIn.password);
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng');
  await signIn(page, signedIn.email.toUpperCase(), signedIn.password);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('navigation').getByText(signedIn.email)).toBeVisible();
});

test('C15 the session lasts 30 days, survives a reload and a new browser', async ({ page, browser, baseURL }) => {
  const address = newEmail();
  await page.goto('/');
  await signUp(page, address);
  await expect(page.getByRole('main')).toBeVisible();
  const sid = (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE)!;
  expect(sid.httpOnly).toBe(true);
  const days = (sid.expires * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(29.9);
  expect(days).toBeLessThan(30.1);
  await page.reload();
  await expect(page.getByRole('main')).toBeVisible();

  // Reopening the browser: a fresh context with the stored (persistent) cookie.
  const reopened = await browser.newContext({ baseURL, storageState: await page.context().storageState() });
  const again = await reopened.newPage();
  await again.goto('/');
  await expect(again.getByRole('main')).toBeVisible();
  await reopened.close();
});

test('C15 "Đăng xuất" ends the session; the old cookie gets 401', async ({ page, signedIn, seedTasks }) => {
  await seedTasks(page, [{ title: 'Mua thuốc dị ứng cho mẹ' }]);
  await page.getByText('Mua thuốc dị ứng cho mẹ').click();
  const sid = (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE)!.value;
  await page.getByRole('navigation').getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByText('Mua thuốc dị ứng cho mẹ')).toHaveCount(0);
  await expect(page.getByText(ENDED)).toHaveCount(0);
  const tasks = await page.request.get('/api/tasks', { headers: { Cookie: `sid=${sid}` } });
  expect(tasks.status()).toBe(401);
  const me = await page.request.get('/api/me', { headers: { Cookie: `sid=${sid}` } });
  expect(me.status()).toBe(401);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible();

  // Signing back in shows the list with nothing selected.
  await signIn(page, signedIn.email, signedIn.password);
  await expect(page.getByRole('listitem')).toHaveAttribute('aria-selected', 'false');
});

test('C16 GET /api/me answers { id, email } or 401; no password_hash anywhere', async ({ page, request, signedIn }) => {
  const anon = await request.get('/api/me');
  expect(anon.status()).toBe(401);
  expect(await anon.json()).toEqual({ error: 'unauthenticated' });
  const me = await page.request.get('/api/me');
  const body = await me.json();
  expect(body).toEqual({ id: expect.any(String), email: signedIn.email });
  const signin = await request.post('/api/account/signin', { data: { email: signedIn.email, password: signedIn.password } });
  const text = await signin.text();
  expect(text).not.toMatch(/password|scrypt/i);
});

test('C17 a task made in one browser shows in another signed in to the same account, never to another account', async ({ page, browser, baseURL, seedTasks }) => {
  const address = newEmail();
  await page.goto('/');
  await signUp(page, address);
  await expect(page.getByRole('main')).toBeVisible();
  await seedTasks(page, [{ title: 'Đổi lịch khám răng sang tuần sau' }]);
  await expect(page.getByText('Đổi lịch khám răng sang tuần sau')).toBeVisible();

  const other = await browser.newContext({ baseURL });
  const second = await other.newPage();
  await second.goto('/');
  await signIn(second, address.toUpperCase(), 'mat-khau-rat-dai');
  await expect(second.getByText('Đổi lịch khám răng sang tuần sau')).toBeVisible();
  await other.close();

  const stranger = await browser.newContext({ baseURL });
  const third = await stranger.newPage();
  await third.goto('/');
  await signUp(third, newEmail());
  await expect(third.getByRole('main')).toBeVisible();
  await third.reload();
  await expect(third.getByRole('main')).toBeVisible();
  await expect(third.getByText('Đổi lịch khám răng sang tuần sau')).toHaveCount(0);
  await stranger.close();
});

test('C18 a session ended elsewhere while the list is open shows the "session ended" line', async ({ page, signedIn, seedTasks, context }) => {
  expect(signedIn.email).toBeTruthy();
  await seedTasks(page, [{ title: 'Gia hạn hộ chiếu' }]);
  await expect(page.getByText('Gia hạn hộ chiếu')).toBeVisible();
  // Signed out elsewhere: the session is gone on the server.
  await page.request.post('/api/account/signout');
  expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false);
  await page.evaluate(async () => {
    const url = '/web/tasks.ts';
    const tasks = await import(/* @vite-ignore */ url);
    await tasks.reload();
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(ENDED);
  await expect(page.getByText('Gia hạn hộ chiếu')).toHaveCount(0);
});

test('C18 no answer from the server on sign in or sign up shows the connection error', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible();
  await page.route('**/api/account/**', (route) => route.abort('connectionrefused'));
  await signIn(page, 'minhthu@example.com', 'mat-khau-1');
  await expect(page.getByRole('alert')).toHaveText('Không kết nối được máy chủ. Thử lại sau.');
  await page.getByRole('link', { name: 'Tạo tài khoản' }).click();
  await email(page).fill(newEmail());
  await password(page).fill('mat-khau-1');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('alert')).toHaveText('Không kết nối được máy chủ. Thử lại sau.');
});

test.describe('C19 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('C19 sign-in: pitch on the left, the form on paper at 520px; colours and fonts of the prototype', async ({ page }) => {
    await page.goto('/');
    const gate = page.locator('[data-slot="gate"]');
    await expect(gate).toBeVisible();
    await expect(gate.getByText('Việc.', { exact: true })).toBeVisible();
    await expect(gate.getByText('Mọi việc cần làm, ở một chỗ, trên mọi máy.')).toBeVisible();
    await expect(gate.getByText('Dữ liệu của bạn gắn với tài khoản, chỉ bạn thấy.')).toBeVisible();
    const form = gate.locator('form');
    const box = (await form.boundingBox())!;
    expect(box.width).toBe(520);
    expect(box.x + box.width).toBe(1440);
    expect(await style(form, 'background-color')).toBe(LIGHT.paper);
    expect(await style(gate, 'background-color')).toBe(LIGHT.bg);
    const heading = page.getByRole('heading', { level: 1, name: 'Đăng nhập' });
    expect(await style(heading, 'font-family')).toContain('Fraunces');
    expect(await style(heading, 'font-size')).toBe('32px');
    expect(await style(gate.getByText('Mọi việc cần làm, ở một chỗ, trên mọi máy.'), 'font-size')).toBe('52px');
    const button = page.getByRole('button', { name: 'Đăng nhập' });
    expect(await style(button, 'background-color')).toBe(LIGHT.accent);
    expect(await style(button, 'color')).toBe(LIGHT.white);
    expect(await style(button, 'font-family')).toContain('Be Vietnam Pro');
    expect(await style(page.getByText('Email', { exact: true }), 'color')).toBe(LIGHT.muted);
    expect(await style(email(page), 'border-top-color')).toBe(LIGHT.line);
    // Order: heading, Email, Mật khẩu, button, switch line.
    const ys = await Promise.all(
      [heading, email(page), password(page), button, page.getByText('Chưa có tài khoản?')].map(async (l) => (await l.boundingBox())!.y),
    );
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  test('C19 sign-in error: the email stays and the message is under the password', async ({ page }) => {
    await page.goto('/');
    await signIn(page, 'minhthu@example.com', 'sai-mat-khau-1');
    const alert = page.getByRole('alert');
    await expect(alert).toHaveText('Email hoặc mật khẩu không đúng');
    await expect(email(page)).toHaveValue('minhthu@example.com');
    expect(await style(alert, 'font-size')).toBe('13px');
    expect(await style(alert, 'font-weight')).toBe('600');
    expect(await style(alert, 'color')).toBe(LIGHT.ink);
    expect((await alert.boundingBox())!.y).toBeGreaterThan((await password(page).boundingBox())!.y);
    expect(await style(password(page), 'border-top-width')).toBe('2px');
  });

  test('C19 sign-up: hint "Ít nhất 8 ký tự" and the link back to "Đăng nhập"', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Tạo tài khoản' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tạo tài khoản' })).toBeVisible();
    await expect(password(page)).toHaveAttribute('placeholder', 'Ít nhất 8 ký tự');
    await expect(page.getByText('Đã có tài khoản?')).toBeVisible();
    await page.getByRole('link', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible();
  });

  test('C19 the dark theme follows the system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    const gate = page.locator('[data-slot="gate"]');
    await expect(gate).toBeVisible();
    expect(await style(gate, 'background-color')).toBe(DARK.bg);
    expect(await style(gate.locator('form'), 'background-color')).toBe(DARK.paper);
    expect(await style(page.getByRole('button', { name: 'Đăng nhập' }), 'background-color')).toBe(DARK.accent);
    expect(await style(page.getByRole('heading', { level: 1 }), 'color')).toBe(DARK.ink);
  });

  test('C19 list: the email and "Đăng xuất" at the bottom of the left rail', async ({ page, signedIn }) => {
    const account = page.getByRole('navigation').locator('[data-slot="account"]');
    await expect(account.getByText(signedIn.email)).toBeVisible();
    expect(await style(account.getByText(signedIn.email), 'font-weight')).toBe('600');
    const out = account.getByRole('button', { name: 'Đăng xuất' });
    await expect(out).toBeVisible();
    expect(await style(out, 'text-decoration-line')).toContain('underline');
    const rail = (await page.getByRole('navigation').boundingBox())!;
    const box = (await account.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(rail.y + rail.height - 60);
  });
});

test.describe('C19 390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('C19 sign-in: one column, brand above the form, no pitch', async ({ page }) => {
    await page.goto('/');
    const gate = page.locator('[data-slot="gate"]');
    await expect(gate.getByText('Việc.', { exact: true })).toBeVisible();
    await expect(gate.getByText('Mọi việc cần làm, ở một chỗ, trên mọi máy.')).toBeHidden();
    const form = gate.locator('form');
    expect((await form.boundingBox())!.width).toBe(390);
    expect(await style(form, 'background-color')).toBe('rgba(0, 0, 0, 0)');
    const brand = (await gate.getByText('Việc.', { exact: true }).boundingBox())!;
    expect(brand.y).toBeLessThan((await page.getByRole('heading', { level: 1 }).boundingBox())!.y);
    expect((await email(page).boundingBox())!.width).toBe(390 - 32);
  });

  test('C19 sign-up error: under the email, "Email này đã có tài khoản · Đăng nhập"', async ({ page, signedIn, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await signUp(page, signedIn.email, 'mat-khau-moi-1');
    const alert = page.getByRole('alert');
    await expect(alert).toHaveText('Email này đã có tài khoản · Đăng nhập');
    expect((await alert.boundingBox())!.y).toBeLessThan((await password(page).boundingBox())!.y);
  });

  test('C19 session ended: the line under the heading', async ({ page, signedIn, seedTasks }) => {
    expect(signedIn.email).toBeTruthy();
    await seedTasks(page, [{ title: 'Gia hạn hộ chiếu' }]);
    await expect(page.getByText('Gia hạn hộ chiếu')).toBeVisible();
    await page.request.post('/api/account/signout');
    await page.evaluate(async () => {
      const url = '/web/tasks.ts';
      const tasks = await import(/* @vite-ignore */ url);
      await tasks.reload();
    });
    const notice = page.getByRole('status');
    await expect(notice).toHaveText(ENDED);
    const heading = (await page.getByRole('heading', { level: 1, name: 'Đăng nhập' }).boundingBox())!;
    const line = (await notice.boundingBox())!;
    expect(line.y).toBeGreaterThan(heading.y);
    expect(line.y).toBeLessThan((await email(page).boundingBox())!.y);
    expect(await style(notice, 'font-weight')).toBe('600');
  });

  test('C15 C19 list: "Đăng xuất" in the top bar beside the brand signs out', async ({ page, signedIn }) => {
    const main = page.getByRole('main');
    const account = main.locator('[data-slot="account"]');
    const out = account.getByRole('button', { name: 'Đăng xuất' });
    await expect(out).toBeVisible();
    await expect(account.getByText(signedIn.email)).toBeHidden();
    const brand = (await main.getByText('Việc.', { exact: true }).boundingBox())!;
    const btn = (await out.boundingBox())!;
    expect(Math.abs(btn.y + btn.height / 2 - (brand.y + brand.height / 2))).toBeLessThan(12);
    expect(btn.x).toBeGreaterThan(brand.x);
    await out.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible();
    expect((await page.request.get('/api/me')).status()).toBe(401);
  });
});
