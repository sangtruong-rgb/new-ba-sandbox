// Shared by the server routes and the forms.

export const MESSAGES = {
  invalidEmail: 'Email không hợp lệ',
  shortPassword: 'Mật khẩu cần ít nhất 8 ký tự',
  emailTaken: 'Email này đã có tài khoản',
  badCredentials: 'Email hoặc mật khẩu không đúng',
  sessionEnded: 'Phiên đăng nhập đã hết, hãy đăng nhập lại.',
  noServer: 'Không kết nối được máy chủ. Thử lại sau.',
} as const;

export const MIN_PASSWORD = 8;

/** name@domain.tld: one @, a dot after the @, no whitespace. */
export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function isValidPassword(password: unknown): password is string {
  return typeof password === 'string' && [...password].length >= MIN_PASSWORD;
}

/** The first sign-up problem, in the order the form reports them; null when there is none. */
export function signUpProblem(email: unknown, password: unknown): 'invalid_email' | 'password_too_short' | null {
  if (!isValidEmail(email)) return 'invalid_email';
  if (!isValidPassword(password)) return 'password_too_short';
  return null;
}
