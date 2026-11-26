import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setListArrangement, setListFilter, useListCounts, type Group } from './list.ts';
import type { FeatureUi } from './registry.ts';
import { Shell } from './shell/Shell.tsx';
import { reset, type Task } from './tasks.ts';
import { mockFetch, task } from './test-support.tsx';

const rowFeature: FeatureUi = {
  id: 'row-probe',
  slots: {
    'item-time': ({ task }: { task: Task }) => <i data-testid="time">{task.title}-time</i>,
    'item-lead': ({ task }: { task: Task }) => <input type="checkbox" aria-label={`lead ${task.title}`} />,
    'item-sub': ({ task }: { task: Task }) => <i data-testid="sub">{task.title}-sub</i>,
    'list-empty': () => <p>Chưa có việc nào.</p>,
  },
};

async function show(tasks: Task[], features: FeatureUi[] = [rowFeature]) {
  mockFetch(() => ({ status: 200, body: tasks }));
  render(<Shell features={features} />);
  await act(async () => {});
}

const rowTitles = () =>
  screen.queryAllByRole('listitem').map((li) => li.querySelector('button')!.firstElementChild!.textContent);

beforeEach(() => {
  reset();
  setListFilter(null);
  setListArrangement(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ListView', () => {
  test('C6 with no filter or arrangement: one untitled group, oldest first', async () => {
    await show([
      task({ title: 'mới', createdAt: '2026-11-20T00:00:00.000Z' }),
      task({ title: 'cũ', createdAt: '2026-11-01T00:00:00.000Z' }),
    ]);
    expect(rowTitles()).toEqual(['cũ', 'mới']);
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });

  test('C6 filters first, then arranges', async () => {
    const arrange = vi.fn((tasks: Task[], _now: Date): Group[] => [{ id: 'g', title: 'Nhóm', tasks }]);
    setListFilter((t) => !t.done);
    setListArrangement(arrange);
    await show([task({ title: 'mở' }), task({ title: 'xong', done: true })]);
    const last = arrange.mock.calls.at(-1)!;
    expect(last[0].map((t) => t.title)).toEqual(['mở']);
    expect(last[1]).toBeInstanceOf(Date);
    expect(rowTitles()).toEqual(['mở']);
  });

  test('C6 a titled group shows its title then its task count; tone alert marks it', async () => {
    setListArrangement((tasks) => [
      { id: 'over', title: 'Quá hạn', tone: 'alert', tasks: tasks.slice(0, 2) },
      { id: 'today', title: 'Hôm nay', tasks: tasks.slice(2) },
      { id: 'none', title: 'Không có hạn', tasks: [] },
    ]);
    await show([task({ title: 'a' }), task({ title: 'b' }), task({ title: 'c' })]);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Quá hạn2', 'Hôm nay1']);
    expect(headings[0]!.querySelector('small')!.textContent).toBe('2');
    expect(headings[0]!.className).toMatch(/alert/);
    expect(headings[1]!.className).not.toMatch(/alert/);
    expect(screen.queryByText('Không có hạn')).toBeNull();
  });

  test('C6 shows slot list-empty when no row is left', async () => {
    setListFilter(() => false);
    await show([task({ title: 'a' })]);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    const empty = document.querySelector('[data-slot="list-empty"]')!;
    expect(empty.textContent).toBe('Chưa có việc nào.');
  });

  test('C6 arranges again with a new now every 60 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-11-26T07:00:00.000Z'));
    const arrange = vi.fn((tasks: Task[], now: Date): Group[] => [{ id: 'g', title: now.toISOString(), tasks }]);
    setListArrangement(arrange);
    await show([task({ title: 'a' })]);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('2026-11-26T07:00:00.000Z1');
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('2026-11-26T07:01:00.000Z1');
  });

  test('C6 a row is item-time, item-lead, then the title with item-sub under it', async () => {
    await show([task({ title: 'Mua thuốc' })]);
    const li = screen.getByRole('listitem');
    const parts = Array.from(li.children);
    expect(parts[0]!.getAttribute('data-slot')).toBe('item-time');
    expect(parts[0]!.textContent).toBe('Mua thuốc-time');
    expect(parts[1]!.querySelector('[data-slot="item-lead"]')).not.toBeNull();
    const titleBlock = parts[2]!;
    expect(titleBlock.children[0]!.textContent).toBe('Mua thuốc');
    expect(titleBlock.children[1]!.getAttribute('data-slot')).toBe('item-sub');
    expect(titleBlock.children[1]!.textContent).toBe('Mua thuốc-sub');
  });

  test('C6 a done task’s row is marked done (title struck through, muted)', async () => {
    await show([task({ title: 'xong', done: true }), task({ title: 'mở' })]);
    const [done, open] = screen.getAllByRole('listitem');
    expect(done!.className).toMatch(/done/);
    expect(open!.className).not.toMatch(/done/);
  });

  test('C6 clicking the row selects it; a click inside item-lead does not', async () => {
    await show([task({ title: 'a' }), task({ title: 'b' })]);
    const [a, b] = screen.getAllByRole('listitem');
    fireEvent.click(within(a!).getByLabelText('lead a'));
    expect(a!.getAttribute('aria-selected')).toBe('false');
    fireEvent.click(within(a!).getByText('a'));
    expect(a!.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(within(b!).getByTestId('time'));
    expect(b!.getAttribute('aria-selected')).toBe('true');
    expect(a!.getAttribute('aria-selected')).toBe('false');
  });

  test('C6 useListCounts counts all tasks, ignoring the filter', async () => {
    let counts = { all: -1, open: -1, done: -1 };
    const Counter = () => {
      counts = useListCounts();
      return null;
    };
    setListFilter((t) => t.done);
    await show([task(), task(), task({ done: true })], [{ id: 'c', slots: { rail: Counter } }]);
    expect(counts).toEqual({ all: 3, open: 2, done: 1 });
  });
});
