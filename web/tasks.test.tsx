import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Shell } from './shell/Shell.tsx';
import { ApiError, api, reset, useSelection, useTasks, type Task } from './tasks.ts';
import { mockFetch, task } from './test-support.tsx';

let serverTasks: Task[] = [];

function Titles({ label }: { label: string }) {
  const { tasks } = useTasks();
  return <p data-testid={label}>{tasks.map((t) => t.title).join(',')}</p>;
}

function Selected({ label }: { label: string }) {
  const [id, select] = useSelection();
  return (
    <button data-testid={label} onClick={() => select('picked')}>
      {id ?? 'none'}
    </button>
  );
}

let reloadFn: () => Promise<void> = async () => {};
function Reloader() {
  reloadFn = useTasks().reload;
  return null;
}

beforeEach(() => {
  reset();
  serverTasks = [task({ title: 'A' })];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('WebTasks', () => {
  test('C5 useTasks loads GET /api/tasks when first rendered', async () => {
    const fetch = mockFetch(() => ({ status: 200, body: serverTasks }));
    render(<Titles label="a" />);
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('A'));
    expect(fetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({ method: 'GET' }));
  });

  test('C5 one store: reload() refreshes every consumer', async () => {
    mockFetch(() => ({ status: 200, body: serverTasks }));
    render(
      <>
        <Titles label="a" />
        <Titles label="b" />
        <Reloader />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId('b').textContent).toBe('A'));
    serverTasks = [...serverTasks, task({ title: 'B' })];
    await act(() => reloadFn());
    expect(screen.getByTestId('a').textContent).toBe('A,B');
    expect(screen.getByTestId('b').textContent).toBe('A,B');
  });

  test('C5 useSelection is shared by every consumer', async () => {
    mockFetch(() => ({ status: 200, body: serverTasks }));
    render(
      <>
        <Selected label="one" />
        <Selected label="two" />
      </>,
    );
    act(() => screen.getByTestId('one').click());
    expect(screen.getByTestId('two').textContent).toBe('picked');
  });

  test('C5 api sends JSON and returns the answer; a non-2xx throws ApiError { status, error }', async () => {
    const fetch = mockFetch((method, url, body) =>
      url === '/api/things' && method === 'POST'
        ? { status: 201, body: { got: body } }
        : { status: 400, body: { error: 'title_required' } },
    );
    expect(await api('/things', { method: 'POST', body: { title: 'x' } })).toEqual({ got: { title: 'x' } });
    expect(fetch.mock.calls[0]![1]).toMatchObject({ headers: { 'Content-Type': 'application/json' } });
    const err = await api('/bad', { method: 'POST' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, error: 'title_required' });
  });

  test('C5 a 401 resets tasks and selection and emits todo:unauthenticated after tasks were loaded', async () => {
    let signedIn = true;
    mockFetch((_m, url) =>
      signedIn || url !== '/api/x' ? { status: 200, body: serverTasks } : { status: 401, body: { error: 'unauthenticated' } },
    );
    const onEvent = vi.fn();
    window.addEventListener('todo:unauthenticated', onEvent);
    render(
      <>
        <Titles label="a" />
        <Selected label="s" />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('A'));
    act(() => screen.getByTestId('s').click());
    signedIn = false;
    await act(async () => {
      await expect(api('/x')).rejects.toMatchObject({ status: 401, error: 'unauthenticated' });
    });
    expect(screen.getByTestId('a').textContent).toBe('');
    expect(screen.getByTestId('s').textContent).toBe('none');
    expect(onEvent).toHaveBeenCalledTimes(1);
    window.removeEventListener('todo:unauthenticated', onEvent);
  });

  test('C5 a 401 before any tasks were loaded resets without the event', async () => {
    mockFetch(() => ({ status: 401, body: { error: 'unauthenticated' } }));
    const onEvent = vi.fn();
    window.addEventListener('todo:unauthenticated', onEvent);
    await expect(api('/me')).rejects.toMatchObject({ status: 401 });
    expect(onEvent).not.toHaveBeenCalled();
    window.removeEventListener('todo:unauthenticated', onEvent);
  });

  test('C5 a 401 with authCheck: true neither resets nor emits', async () => {
    mockFetch((_m, url) => (url === '/api/me' ? { status: 401, body: { error: 'unauthenticated' } } : { status: 200, body: serverTasks }));
    const onEvent = vi.fn();
    window.addEventListener('todo:unauthenticated', onEvent);
    render(<Titles label="a" />);
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('A'));
    await act(async () => {
      await expect(api('/me', { authCheck: true })).rejects.toMatchObject({ status: 401 });
    });
    expect(screen.getByTestId('a').textContent).toBe('A');
    expect(onEvent).not.toHaveBeenCalled();
    window.removeEventListener('todo:unauthenticated', onEvent);
  });

  test('C5 a 404 calls reload()', async () => {
    const fetch = mockFetch((_m, url) => (url === '/api/tasks' ? { status: 200, body: serverTasks } : { status: 404, body: { error: 'not_found' } }));
    render(<Titles label="a" />);
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('A'));
    serverTasks = [];
    await act(async () => {
      await expect(api('/tasks/gone', { method: 'DELETE' })).rejects.toMatchObject({ status: 404, error: 'not_found' });
    });
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe(''));
    expect(fetch.mock.calls.filter(([u]) => u === '/api/tasks')).toHaveLength(2);
  });

  test('C5 a 5xx shows "Không kết nối được máy chủ. Thử lại sau." at the top of the list column for 5 seconds', async () => {
    mockFetch((_m, url) => (url === '/api/tasks' ? { status: 200, body: serverTasks } : { status: 503 }));
    render(<Shell features={[]} />);
    await screen.findByText('A');
    vi.useFakeTimers();
    await act(async () => {
      await expect(api('/boom')).rejects.toMatchObject({ status: 503 });
    });
    const line = screen.getByRole('alert');
    expect(line.textContent).toBe('Không kết nối được máy chủ. Thử lại sau.');
    expect(line.parentElement!.tagName).toBe('MAIN');
    expect(line.parentElement!.firstElementChild).toBe(line);
    act(() => vi.advanceTimersByTime(4900));
    expect(screen.queryByRole('alert')).not.toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('C5 a network failure shows the same line and throws ApiError', async () => {
    mockFetch((_m, url) => (url === '/api/tasks' ? { status: 200, body: serverTasks } : 'network'));
    render(<Shell features={[]} />);
    await screen.findByText('A');
    await act(async () => {
      const err = await api('/x').catch((e: ApiError) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(0);
    });
    expect(screen.getByRole('alert').textContent).toBe('Không kết nối được máy chủ. Thử lại sau.');
  });

  test('C5 reset() empties the tasks and the selection', async () => {
    mockFetch(() => ({ status: 200, body: serverTasks }));
    render(
      <>
        <Titles label="a" />
        <Selected label="s" />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('A'));
    act(() => screen.getByTestId('s').click());
    act(() => reset());
    expect(screen.getByTestId('a').textContent).toBe('');
    expect(screen.getByTestId('s').textContent).toBe('none');
  });
});
