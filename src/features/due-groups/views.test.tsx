import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Shell } from '../../../web/shell/Shell.tsx';
import { reset } from '../../../web/tasks.ts';
import { mockFetch, task } from '../../../web/test-support.tsx';
import feature from './index.ts';

const at = (day: number, h: number, m: number) => new Date(2026, 10, day, h, m).toISOString();

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

async function show(...tasks: ReturnType<typeof task>[]) {
  mockFetch(() => ({ status: 200, body: tasks }));
  const view = render(<Shell features={[feature]} />);
  await wait(0);
  return view.container;
}

const slot = (c: HTMLElement, id: string, name: string) =>
  c.querySelector(`[data-task-id="${id}"] [data-slot="${name}"]`)!.textContent;
const groups = (c: HTMLElement) => [...c.querySelectorAll('[data-group] h2')].map((h) => h.textContent);

describe('due groups on the page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 26, 14, 20, 30));
  });
  afterEach(() => {
    cleanup();
    reset();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('C36 item-time and item-sub show day and time, only the time today, nothing when done or without due', async () => {
    const c = await show(
      task({ id: 'late', dueAt: at(25, 17, 0) }),
      task({ id: 'today', dueAt: at(26, 15, 30) }),
      task({ id: 'soon', dueAt: at(28, 23, 59) }),
      task({ id: 'none' }),
      task({ id: 'done', done: true, dueAt: at(26, 15, 30) }),
    );
    expect(slot(c, 'late', 'item-time')).toBe('Hôm qua17:00');
    expect(slot(c, 'late', 'item-sub')).toBe('Hôm qua · 17:00');
    expect(slot(c, 'today', 'item-time')).toBe('15:30');
    expect(slot(c, 'today', 'item-sub')).toBe('15:30');
    expect(slot(c, 'soon', 'item-time')).toBe('T7 28/1123:59');
    expect(slot(c, 'soon', 'item-sub')).toBe('T7 28/11 · 23:59');
    for (const id of ['none', 'done']) {
      expect(slot(c, id, 'item-time')).toBe('');
      expect(slot(c, id, 'item-sub')).toBe('');
    }
  });

  test('C37 a task that falls due while the page is open moves to "Quá hạn" within a minute', async () => {
    const c = await show(task({ id: 'a', dueAt: at(26, 14, 21) }));
    expect(groups(c)).toEqual(['Hôm nay1']);
    await wait(30_000); // 14:21:00, not yet past the minute
    expect(groups(c)).toEqual(['Hôm nay1']);
    await wait(61_000);
    expect(groups(c)).toEqual(['Quá hạn1']);
    expect(slot(c, 'a', 'item-sub')).toBe('Hôm nay · 14:21');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Còn 1 việc, 1 việc đã quá hạn');
  });

  test('C38 the date line and heading follow a change of day within a minute', async () => {
    vi.setSystemTime(new Date(2026, 10, 26, 23, 59, 30));
    await show(task({ dueAt: at(26, 23, 59) }));
    expect(screen.getByText('Thứ Năm · 26 tháng 11')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Còn 1 việc');
    await wait(60_000);
    expect(screen.getByText('Thứ Sáu · 27 tháng 11')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Còn 1 việc, 1 việc đã quá hạn');
  });
});
