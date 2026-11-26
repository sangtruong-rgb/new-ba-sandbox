import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { api, ApiError, UNAUTHENTICATED_EVENT } from '../../../web/tasks.ts';
import { MESSAGES, signUpProblem } from './rules.ts';
import { checkSession, setAuth, useAuth, type Me } from './session.ts';
import s from './account.module.css';

type Mode = 'in' | 'up';
type Field = 'email' | 'password' | 'form';
type Problem = { field: Field; message: string; signInLink?: boolean } | null;

const SIGN_UP_MESSAGES = {
  invalid_email: { field: 'email', message: MESSAGES.invalidEmail },
  password_too_short: { field: 'password', message: MESSAGES.shortPassword },
} as const;

function SignForm({ ended }: { ended: boolean }) {
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<Problem>(null);
  const [notice, setNotice] = useState(ended);
  const [busy, setBusy] = useState(false);
  const up = mode === 'up';

  const switchTo = (next: Mode) => (e: MouseEvent) => {
    e.preventDefault();
    setMode(next);
    setProblem(null);
    setPassword('');
    setNotice(false);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setNotice(false);
    setProblem(null);
    if (up) {
      const local = signUpProblem(email, password);
      if (local) {
        setProblem(SIGN_UP_MESSAGES[local]);
        return;
      }
    }
    setBusy(true);
    try {
      const user = (await api(up ? '/account/signup' : '/account/signin', {
        method: 'POST',
        body: { email, password },
        authCheck: true,
      })) as Me;
      setAuth({ status: 'in', user: { id: user.id, email: user.email } });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const code = err instanceof ApiError ? err.error : '';
      if (status === 0 || status >= 500) setProblem({ field: 'form', message: MESSAGES.noServer });
      else if (up && code === 'email_taken') setProblem({ field: 'email', message: MESSAGES.emailTaken, signInLink: true });
      else if (up && (code === 'invalid_email' || code === 'password_too_short')) setProblem(SIGN_UP_MESSAGES[code]);
      else if (!up) setProblem({ field: 'password', message: MESSAGES.badCredentials });
      else setProblem({ field: 'form', message: MESSAGES.noServer });
      setBusy(false);
    }
  }

  // Signing in, a wrong answer marks both fields; the message sits under the password.
  const emailInvalid = problem?.field === 'email' || (!up && problem?.field === 'password');
  const passwordInvalid = problem?.field === 'password';

  return (
    <div className={s.gate} data-slot="gate">
      <div className={s.left}>
        <div className={s.brand}>
          Việc<span>.</span>
        </div>
        <p className={s.pitch}>Mọi việc cần làm, ở một chỗ, trên mọi máy.</p>
        <small className={s.privacy}>Dữ liệu của bạn gắn với tài khoản, chỉ bạn thấy.</small>
      </div>
      <form className={s.form} onSubmit={submit} noValidate aria-label={up ? 'Tạo tài khoản' : 'Đăng nhập'}>
        <h1 className={s.title}>{up ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
        {notice && !up && (
          <p className={s.notice} role="status">
            {MESSAGES.sessionEnded}
          </p>
        )}
        <label className={s.label} htmlFor="account-email">
          Email
        </label>
        <input
          id="account-email"
          className={s.field}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={emailInvalid ? 'true' : undefined}
        />
        {problem?.field === 'email' && (
          <p className={s.err} role="alert">
            {problem.message}
            {problem.signInLink && (
              <>
                {' · '}
                <a href="#sign-in" onClick={switchTo('in')}>
                  Đăng nhập
                </a>
              </>
            )}
          </p>
        )}
        <label className={s.label} htmlFor="account-password">
          Mật khẩu
        </label>
        <input
          id="account-password"
          className={s.field}
          type="password"
          autoComplete={up ? 'new-password' : 'current-password'}
          placeholder={up ? 'Ít nhất 8 ký tự' : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={passwordInvalid ? 'true' : undefined}
        />
        {(problem?.field === 'password' || problem?.field === 'form') && (
          <p className={s.err} role="alert">
            {problem.message}
          </p>
        )}
        <button type="submit" className={s.primary} disabled={busy}>
          {up ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>
        <p className={s.switch}>
          {up ? (
            <>
              Đã có tài khoản?{' '}
              <a href="#sign-in" onClick={switchTo('in')}>
                Đăng nhập
              </a>
            </>
          ) : (
            <>
              Chưa có tài khoản?{' '}
              <a href="#sign-up" onClick={switchTo('up')}>
                Tạo tài khoản
              </a>
            </>
          )}
        </p>
      </form>
    </div>
  );
}

/** Slot gate: the page for a signed-in user, the sign-in screen otherwise. */
export function Gate({ children }: { children: ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    void checkSession();
    const ended = () => setAuth({ status: 'out', ended: true });
    window.addEventListener(UNAUTHENTICATED_EVENT, ended);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, ended);
  }, []);

  if (auth.status === 'out') {
    return <SignForm key={auth.ended ? 'ended' : 'fresh'} ended={auth.ended} />;
  }
  // While GET /api/me answers, the page is already mounted (its features set up as on any load)
  // but covered, so nothing of it shows before the user is known.
  return (
    <>
      {children}
      {auth.status === 'loading' && <div className={s.blank} data-slot="gate-loading" aria-busy="true" />}
    </>
  );
}
