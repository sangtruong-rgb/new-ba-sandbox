import type { Locator, Page } from '@playwright/test';
import { expect, test, type SeedTask } from './support/fixtures.ts';

// The browser runs in Asia/Ho_Chi_Minh; its clock starts at Thursday 26/11/2026 14:20.
const NOW = '2026-11-26T14:20:00+07:00';
const at = (day: string, time: string) => new Date(`2026-${day}T${time}:00+07:00`).toISOString();

const SAMPLE: SeedTask[] = [
  { title: 'Đóng tiền internet tháng 11', dueAt: at('11-26', '09:00') },
  { title: 'Gửi báo giá cho khách Phú Mỹ', dueAt: at('11-25', '17:00') },
  { title: 'Họp review thiết kế màn đặt lịch', dueAt: at('11-26', '15:30') },
  { title: 'Nộp tờ khai thuế TNCN quý 4', dueAt: at('11-28', '23:59') },
  { title: 'Đọc nốt chương 6' },
  { title: 'Gia hạn hộ chiếu', done: true },
];

const COLOURS = {
  light: { accent: 'rgb(185, 58, 37)', muted: 'rgb(106, 98, 86)', ink: 'rgb(30, 26, 21)' },
  dark: { accent: 'rgb(239, 122, 92)', muted: 'rgb(173, 163, 147)', ink: 'rgb(239, 232, 220)' },
};

const css = (loc: Locator, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

async function open(page: Page, seed: (page: Page, tasks: SeedTask[]) => Promise<unknown>, tasks = SAMPLE) {
  await page.clock.install({ time: new Date(NOW) });
  await seed(page, tasks);
}

const row = (page: Page, title: string) => page.getByRole('listitem').filter({ hasText: title });
const groupTitles = (page: Page) => page.getByRole('main').getByRole('heading', { level: 2 });

test('C33 C35 the list is grouped by due time, with counts, and empty groups hidden', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await open(page, seedTasks);
  await expect(groupTitles(page)).toHaveText(['Quá hạn2', 'Hôm nay1', 'Sắp tới1', 'Không có hạn1', 'Đã xong1']);
  await expect(page.getByRole('listitem').first()).toContainText('Gửi báo giá cho khách Phú Mỹ');
  await seedTasks(page, []);
  await expect(groupTitles(page)).toHaveCount(5);
});

test('C37 C38 a task falling due moves to "Quá hạn" and the heading follows, without a reload', async ({ page, signedIn, seedTasks }) => {
  expect(signedIn.email).toBeTruthy();
  await open(page, seedTasks, [{ title: 'Mua thuốc dị ứng cho mẹ', dueAt: at('11-26', '14:25') }]);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(page.getByText('Thứ Năm · 26 tháng 11')).toBeVisible();
  await expect(heading).toHaveText('Còn 1 việc');
  await expect(groupTitles(page)).toHaveText(['Hôm nay1']);
  await page.clock.fastForward('06:00');
  await expect(groupTitles(page)).toHaveText(['Quá hạn1']);
  await expect(heading).toHaveText('Còn 1 việc, 1 việc đã quá hạn');
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`1440 ${scheme}`, () => {
    test.use({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });

    test(`C34 C36 C39 summary and item-time look like the prototype (${scheme})`, async ({ page, signedIn, seedTasks }) => {
      expect(signedIn.email).toBeTruthy();
      await open(page, seedTasks);
      const colour = COLOURS[scheme];

      const date = page.getByText('Thứ Năm · 26 tháng 11');
      expect(await css(date, 'text-transform')).toBe('uppercase');
      expect(await css(date, 'font-size')).toBe('13px');
      expect(await css(date, 'color')).toBe(colour.muted);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveText('Còn 5 việc, 2 việc đã quá hạn');
      expect(await css(heading, 'font-family')).toContain('Fraunces');
      expect(await css(heading, 'font-size')).toBe('44px');
      expect(await css(heading, 'color')).toBe(colour.ink);
      expect(await css(groupTitles(page).first(), 'color')).toBe(colour.accent);

      const late = row(page, 'Gửi báo giá').locator('[data-slot="item-time"]');
      await expect(late).toHaveText('Hôm qua17:00');
      expect(await css(late.getByText('Hôm qua'), 'display')).toBe('block');
      expect(await css(late.getByText('Hôm qua'), 'font-size')).toBe('12px');
      expect(await css(late.locator('span'), 'color')).toBe(colour.accent);
      expect(await css(late.locator('span'), 'font-weight')).toBe('600');

      const today = row(page, 'Họp review').locator('[data-slot="item-time"]');
      await expect(today).toHaveText('15:30');
      expect(await css(today.locator('span'), 'color')).toBe(colour.muted);
      await expect(row(page, 'Nộp tờ khai').locator('[data-slot="item-time"]')).toHaveText('T7 28/1123:59');
      await expect(row(page, 'Gia hạn').locator('[data-slot="item-time"]')).toHaveText('');
    });
  });

  test.describe(`390 ${scheme}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, colorScheme: scheme });

    test(`C34 C36 C39 summary and item-sub look like the prototype (${scheme})`, async ({ page, signedIn, seedTasks }) => {
      expect(signedIn.email).toBeTruthy();
      await open(page, seedTasks);
      const colour = COLOURS[scheme];
      expect(await css(page.getByRole('heading', { level: 1 }), 'font-size')).toBe('26px');

      const late = row(page, 'Gửi báo giá').locator('[data-slot="item-sub"] span');
      await expect(late).toBeVisible();
      await expect(late).toHaveText('Hôm qua · 17:00');
      expect(await css(late, 'color')).toBe(colour.accent);
      expect(await css(late, 'font-weight')).toBe('600');
      expect(await css(late, 'font-size')).toBe('13px');

      const today = row(page, 'Họp review').locator('[data-slot="item-sub"] span');
      await expect(today).toHaveText('15:30');
      expect(await css(today, 'color')).toBe(colour.muted);
      await expect(row(page, 'Nộp tờ khai').locator('[data-slot="item-sub"]')).toHaveText('T7 28/11 · 23:59');
      await expect(row(page, 'Đọc nốt').locator('[data-slot="item-sub"]')).toHaveText('');
    });
  });
}
