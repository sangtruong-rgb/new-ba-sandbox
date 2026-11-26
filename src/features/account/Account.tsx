import { signOut, useAuth } from './session.ts';
import s from './account.module.css';

/** Slot account: the signed-in email and "Đăng xuất". */
export function Account() {
  const auth = useAuth();
  return (
    <div className={s.account}>
      {auth.status === 'in' && <strong className={s.email}>{auth.user.email}</strong>}
      <button type="button" className={s.linkbtn} onClick={() => void signOut()}>
        Đăng xuất
      </button>
    </div>
  );
}
