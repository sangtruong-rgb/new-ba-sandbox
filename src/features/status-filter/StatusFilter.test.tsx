import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { reset, type Task } from '../../../web/tasks.ts';
import { mockFetch, task } from '../../../web/test-support.tsx';

let tasks: Task[] = [];

/** A fresh copy of the feature, as after a page load. */
async function load() {
  vi.resetModules();
  const list = await import('../../../web/list.ts');
  const { Shell } = await import('../../../web/shell/Shell.tsx');
  const store = await import('../../../web/tasks.ts');
  const feature = (await import('./index.ts')).default;
  return { list, Shell, store, feature };
}

async function open() {
  const { Shell, store, feature, list } = await load();
  render(<Shell features={[feature]} />);
  await act(() => store.reload());
  return { store, feature, list };
}

const filterButton = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label} \\d+$`) });
const titles = () => screen.queryAllByRole('listitem').map((li) => li.textContent);
const choose = (label: string) => fireEvent.click(filterButton(label));

beforeEach(() => {
  window.localStorage.clear();
  tasks = [task({ title: 'Mở' }), task({ title: 'Xong', done: true }), task({ title: 'Mở nữa' })];
  mockFetch(() => ({ status: 200, body: tasks }));
});

afterEach(() => {
  cleanup();
  reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('status filter', () => {
  test('C40 shows the three filters with counts, "Tất cả" current by default', async () => {
    await open();
    expect(filterButton('Tất cả').textContent).toBe('Tất cả 3');
    expect(filterButton('Chưa xong').textContent).toBe('Chưa xong 2');
    expect(filterButton('Đã xong').textContent).toBe('Đã xong 1');
    expect(filterButton('Tất cả').getAttribute('aria-current')).toBe('page');
    expect(filterButton('Chưa xong').hasAttribute('aria-current')).toBe(false);
    expect(filterButton('Đã xong').hasAttribute('aria-current')).toBe(false);
  });

  test('C41 each choice narrows the list and moves aria-current', async () => {
    await open();
    choose('Chưa xong');
    expect(titles()).toEqual(['Mở', 'Mở nữa']);
    expect(filterButton('Chưa xong').getAttribute('aria-current')).toBe('page');
    expect(filterButton('Tất cả').hasAttribute('aria-current')).toBe(false);
    choose('Đã xong');
    expect(titles()).toEqual(['Xong']);
    choose('Tất cả');
    expect(titles()).toEqual(['Mở', 'Xong', 'Mở nữa']);
  });

  test('C42 counts and rows follow a reload of the shared store', async () => {
    const { store } = await open();
    choose('Chưa xong');
    tasks = [task({ title: 'Mới', done: true })];
    await act(() => store.reload());
    expect(filterButton('Tất cả').textContent).toBe('Tất cả 1');
    expect(filterButton('Chưa xong').textContent).toBe('Chưa xong 0');
    expect(filterButton('Đã xong').textContent).toBe('Đã xong 1');
    expect(titles()).toEqual([]);
  });

  test('C43 the choice is stored under todo.filter and applied on the next load', async () => {
    const first = await open();
    expect(first.feature.storageKeys).toEqual(['todo.filter']);
    choose('Đã xong');
    expect(window.localStorage.getItem('todo.filter')).toBe('done');
    cleanup();
    await open();
    expect(filterButton('Đã xong').getAttribute('aria-current')).toBe('page');
    expect(titles()).toEqual(['Xong']);
  });

  test('C43 an unknown stored value falls back to "Tất cả"', async () => {
    window.localStorage.setItem('todo.filter', 'nonsense');
    await open();
    expect(filterButton('Tất cả').getAttribute('aria-current')).toBe('page');
    expect(titles()).toHaveLength(3);
  });

  test('C43 filtering still works when storage is blocked', async () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(blocked);
    await open();
    choose('Đã xong');
    expect(titles()).toEqual(['Xong']);
  });

  test('C44 with no task at all every filter says to write the first one', async () => {
    tasks = [];
    await open();
    for (const label of ['Tất cả', 'Chưa xong', 'Đã xong']) {
      choose(label);
      expect(screen.getByText('Viết việc đầu tiên vào ô phía trên.')).toBeTruthy();
    }
  });

  test('C44 says when nothing is left open, or nothing is done yet', async () => {
    tasks = [task({ done: true })];
    const { store } = await open();
    choose('Chưa xong');
    expect(screen.getByText('Không còn việc nào chưa xong.')).toBeTruthy();
    tasks = [task()];
    await act(() => store.reload());
    choose('Đã xong');
    expect(screen.getByText('Chưa có việc nào xong.')).toBeTruthy();
  });
});
