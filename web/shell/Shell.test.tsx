import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setListArrangement, setListFilter } from '../list.ts';
import { SLOT_NAMES, type FeatureUi } from '../registry.ts';
import { reset, type Task } from '../tasks.ts';
import { mockFetch, task } from '../test-support.tsx';
import { Shell } from './Shell.tsx';

const tasks = [task({ title: 'Họp review' }), task({ title: 'Mua thuốc' })];

async function show(features: FeatureUi[], list: Task[] = tasks) {
  mockFetch(() => ({ status: 200, body: list }));
  render(<Shell features={features} />);
  await act(async () => {});
}

const slot = (name: string) => document.querySelectorAll(`[data-slot="${name}"]`);

beforeEach(() => {
  reset();
  setListFilter(null);
  setListArrangement(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Shell slots', () => {
  test('C4 with no feature the frame and its empty slots render', async () => {
    await show([]);
    expect(screen.getByRole('navigation')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('complementary')).toBeTruthy();
    expect(screen.getAllByText('Việc.').length).toBeGreaterThan(0);
    for (const name of ['account', 'rail', 'summary', 'input', 'detail', 'item-time', 'item-lead', 'item-sub']) {
      expect(slot(name).length, name).toBeGreaterThan(0);
    }
    expect(slot('detail-actions')).toHaveLength(0);
  });

  test('C4 a feature’s components are drawn in their slots with the slot props', async () => {
    const seen: Record<string, unknown> = {};
    const probe = (name: string) => (props: Record<string, unknown>) => {
      seen[name] = props;
      return <span>{name}-probe</span>;
    };
    const feature: FeatureUi = {
      id: 'probe',
      slots: Object.fromEntries(SLOT_NAMES.filter((n) => n !== 'gate' && n !== 'list-empty').map((n) => [n, probe(n)])),
    };
    await show([feature]);
    for (const name of ['account', 'rail', 'summary', 'input', 'detail']) {
      expect(slot(name)[0]!.textContent).toBe(`${name}-probe`);
    }
    expect(seen['detail']).toEqual({ task: null });
    expect(seen['account']).toEqual({});
    expect(slot('item-time')).toHaveLength(2);
    expect(slot('item-lead')[0]!.textContent).toBe('item-lead-probe');
    expect(seen['item-sub']).toEqual({ task: tasks[1] });
  });

  test('C4 several features fill one slot in order', async () => {
    // Shell draws in the order given; featureUis() sorts the discovered features by order, then id.
    await show([
      { id: 'a', slots: { summary: () => <b>A</b> } },
      { id: 'b', slots: { summary: () => <b>B</b> } },
    ]);
    expect(slot('summary')[0]!.textContent).toBe('AB');
  });

  test('C4 slot gate wraps the whole page with { children }', async () => {
    const Gate = ({ children }: { children: ReactNode }) => (
      <div data-testid="gate">{children}</div>
    );
    await show([{ id: 'gate', slots: { gate: Gate } }]);
    expect(screen.getByTestId('gate').contains(screen.getByRole('main'))).toBe(true);
  });

  test('C4 a gate can replace the page', async () => {
    await show([{ id: 'gate', slots: { gate: () => <p>Đăng nhập</p> } }]);
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.getByText('Đăng nhập')).toBeTruthy();
  });

  test('C7 detail-actions is drawn under detail only while a task is selected; detail gets the task', async () => {
    const seen: unknown[] = [];
    await show([
      {
        id: 'd',
        slots: {
          detail: ({ task }: { task: Task | null }) => <p>{task ? task.title : 'Chọn một việc'}</p>,
          'detail-actions': ({ task }: { task: Task }) => {
            seen.push(task);
            return <button>Xóa việc</button>;
          },
        },
      },
    ]);
    expect(slot('detail-actions')).toHaveLength(0);
    expect(slot('detail')[0]!.textContent).toBe('Chọn một việc');
    fireEvent.click(screen.getByText('Mua thuốc'));
    expect(slot('detail')[0]!.textContent).toBe('Mua thuốc');
    const actions = slot('detail-actions')[0]!;
    expect(actions.textContent).toBe('Xóa việc');
    expect(actions.previousElementSibling).toBe(slot('detail')[0]);
    expect(seen.at(-1)).toEqual(tasks[1]);
  });

  test('C7 the link "‹ Danh sách" is at the top of the pane while a task is selected and clears the selection', async () => {
    await show([]);
    expect(screen.queryByText('‹ Danh sách')).toBeNull();
    fireEvent.click(screen.getByText('Họp review'));
    const back = screen.getByRole('button', { name: '‹ Danh sách' });
    expect(back.parentElement!.firstElementChild).toBe(back);
    fireEvent.click(back);
    expect(screen.queryByText('‹ Danh sách')).toBeNull();
    expect(screen.getAllByRole('listitem').every((li) => li.getAttribute('aria-selected') === 'false')).toBe(true);
  });
});
