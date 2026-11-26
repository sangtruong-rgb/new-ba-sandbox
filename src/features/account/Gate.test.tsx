import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Shell } from '../../../web/shell/Shell.tsx';
import { api, reset } from '../../../web/tasks.ts';
import { mockFetch, task } from '../../../web/test-support.tsx';
import account from './index.ts';
import { resetAuth } from './session.ts';

type Reply = { status: number; body?: unknown } | 'network';
type Route = (method: string, url: string, body: unknown) => Reply | undefined;

const ME = { id: 'u1', email: 'minhthu@example.com' };

function serve(route: Route) {
  return mockFetch((method, url, body) => route(method, url, body) ?? { status: 404, body: { error: 'not_found' } });
}

async function show() {
  render(<Shell features={[account]} />);
  await act(async () => {});
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

async function type(name: string, value: string) {
  fireEvent.change(field(name), { target: { value } });
}

async function submit(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: label }));
  });
  await act(async () => {});
}

const signedOut: Route = (m, url) => (m === 'GET' && url === '/api/me' ? { status: 401, body: { error: 'unauthenticated' } } : undefined);

beforeEach(() => {
  reset();
  resetAuth();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('sign in screen', () => {
  test('C11 signed out, / shows only "Đăng nhập": Email, Mật khẩu, the button and "Tạo tài khoản"', async () => {
    const fetch = serve(signedOut);
    await show();
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy();
    expect(field('Email').type).toBe('email');
    expect(field('Mật khẩu').type).toBe('password');
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tạo tài khoản' })).toBeTruthy();
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(fetch.mock.calls.map((c) => c[0])).not.toContain('/api/tasks');
    expect(screen.queryByText('Phiên đăng nhập đã hết, hãy đăng nhập lại.')).toBeNull();
  });

  test('C14 the right email and password show the list', async () => {
    let sent: unknown;
    serve((m, url, body) => {
      if (url === '/api/account/signin') {
        sent = body;
        return { status: 200, body: ME };
      }
      if (url === '/api/tasks') return { status: 200, body: [task({ title: 'Gia hạn hộ chiếu' })] };
      return signedOut(m, url, body);
    });
    await show();
    await type('Email', 'MinhThu@Example.com');
    await type('Mật khẩu', 'mat-khau-1');
    await submit('Đăng nhập');
    expect(sent).toEqual({ email: 'MinhThu@Example.com', password: 'mat-khau-1' });
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByText('Gia hạn hộ chiếu')).toBeTruthy();
    expect(screen.getAllByText('minhthu@example.com').length).toBeGreaterThan(0);
  });

  test('C14 a wrong email or password shows "Email hoặc mật khẩu không đúng"', async () => {
    serve((m, url, body) =>
      url === '/api/account/signin' ? { status: 401, body: { error: 'invalid_credentials' } } : signedOut(m, url, body),
    );
    await show();
    await type('Email', 'minhthu@example.com');
    await type('Mật khẩu', 'sai-mat-khau');
    await submit('Đăng nhập');
    expect(screen.getByRole('alert').textContent).toBe('Email hoặc mật khẩu không đúng');
    expect(field('Email').value).toBe('minhthu@example.com');
    expect(field('Mật khẩu').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByText('Phiên đăng nhập đã hết, hãy đăng nhập lại.')).toBeNull();
  });

  test('C18 no answer from the server on sign in shows "Không kết nối được máy chủ. Thử lại sau."', async () => {
    serve((m, url, body) => (url === '/api/account/signin' ? 'network' : signedOut(m, url, body)));
    await show();
    await type('Email', 'minhthu@example.com');
    await type('Mật khẩu', 'mat-khau-1');
    await submit('Đăng nhập');
    expect(screen.getByRole('alert').textContent).toBe('Không kết nối được máy chủ. Thử lại sau.');
  });
});

describe('sign up screen', () => {
  async function openSignUp() {
    await show();
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Tạo tài khoản' }));
    });
  }

  test('C12 a valid email and password create the account and show the empty list', async () => {
    let sent: unknown;
    serve((m, url, body) => {
      if (url === '/api/account/signup') {
        sent = body;
        return { status: 201, body: ME };
      }
      if (url === '/api/tasks') return { status: 200, body: [] };
      return signedOut(m, url, body);
    });
    await openSignUp();
    expect(screen.getByRole('heading', { level: 1, name: 'Tạo tài khoản' })).toBeTruthy();
    expect(field('Mật khẩu').placeholder).toBe('Ít nhất 8 ký tự');
    await type('Email', 'minhthu@example.com');
    await type('Mật khẩu', '12345678');
    await submit('Tạo tài khoản');
    expect(sent).toEqual({ email: 'minhthu@example.com', password: '12345678' });
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  test('C13 one error at a time, in order, under its field; nothing is sent', async () => {
    const fetch = serve(signedOut);
    await openSignUp();
    await type('Email', 'minhthu@example');
    await type('Mật khẩu', '123');
    await submit('Tạo tài khoản');
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(['Email không hợp lệ']);
    expect(field('Email').getAttribute('aria-invalid')).toBe('true');
    expect(field('Email').nextElementSibling?.textContent).toBe('Email không hợp lệ');

    await type('Email', 'minhthu@example.com');
    await submit('Tạo tài khoản');
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(['Mật khẩu cần ít nhất 8 ký tự']);
    expect(field('Mật khẩu').getAttribute('aria-invalid')).toBe('true');
    expect(field('Email').getAttribute('aria-invalid')).toBeNull();
    expect(field('Mật khẩu').nextElementSibling?.textContent).toBe('Mật khẩu cần ít nhất 8 ký tự');
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/me']);
  });

  test('C13 an email that has an account shows "Email này đã có tài khoản · Đăng nhập"', async () => {
    serve((m, url, body) =>
      url === '/api/account/signup' ? { status: 409, body: { error: 'email_taken' } } : signedOut(m, url, body),
    );
    await openSignUp();
    await type('Email', 'MinhThu@example.com');
    await type('Mật khẩu', '12345678');
    await submit('Tạo tài khoản');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Email này đã có tài khoản · Đăng nhập');
    expect(field('Email').nextElementSibling).toBe(alert);
    expect(field('Email').getAttribute('aria-invalid')).toBe('true');
    await act(async () => {
      fireEvent.click(alert.querySelector('a')!);
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy();
    expect(field('Email').value).toBe('MinhThu@example.com');
  });

  test('C18 no answer from the server on sign up shows "Không kết nối được máy chủ. Thử lại sau."', async () => {
    serve((m, url, body) => (url === '/api/account/signup' ? { status: 502 } : signedOut(m, url, body)));
    await openSignUp();
    await type('Email', 'minhthu@example.com');
    await type('Mật khẩu', '12345678');
    await submit('Tạo tài khoản');
    expect(screen.getByRole('alert').textContent).toBe('Không kết nối được máy chủ. Thử lại sau.');
  });
});

describe('signed in', () => {
  const signedIn: Route = (m, url) => {
    if (url === '/api/me') return { status: 200, body: ME };
    if (url === '/api/tasks') return { status: 200, body: [task({ title: 'Mua thuốc dị ứng cho mẹ' })] };
    if (url === '/api/account/signout') return { status: 200, body: { ok: true } };
    return undefined;
  };

  test('C15 "Đăng xuất" ends the session, empties the list and shows "Đăng nhập"', async () => {
    const fetch = serve(signedIn);
    await show();
    fireEvent.click(screen.getByText('Mua thuốc dị ứng cho mẹ'));
    expect(screen.getByRole('listitem').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('minhthu@example.com')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    });
    await act(async () => {});
    expect(fetch.mock.calls.some((c) => c[0] === '/api/account/signout' && c[1]?.method === 'POST')).toBe(true);
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy();
    expect(screen.queryByText('Mua thuốc dị ứng cho mẹ')).toBeNull();
    expect(screen.queryByText('Phiên đăng nhập đã hết, hãy đăng nhập lại.')).toBeNull();

    // Signing back in loads the list afresh, with no task selected.
    serve((m, url, body) => (url === '/api/account/signin' ? { status: 200, body: ME } : signedIn(m, url, body)));
    await type('Email', 'minhthu@example.com');
    await type('Mật khẩu', 'mat-khau-1');
    await submit('Đăng nhập');
    expect(screen.getByRole('listitem').getAttribute('aria-selected')).toBe('false');
  });

  test('C18 a 401 while the list is open shows "Phiên đăng nhập đã hết, hãy đăng nhập lại."', async () => {
    serve(signedIn);
    await show();
    expect(screen.getByText('Mua thuốc dị ứng cho mẹ')).toBeTruthy();
    serve(() => ({ status: 401, body: { error: 'unauthenticated' } }));
    await act(async () => {
      await api('/tasks/x', { method: 'PATCH', body: {} }).catch(() => {});
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Phiên đăng nhập đã hết, hãy đăng nhập lại.');
    expect(screen.queryByText('Mua thuốc dị ứng cho mẹ')).toBeNull();
  });
});
