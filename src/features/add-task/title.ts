// The rule for a task name, used by the server and the web.

export const TITLE_MESSAGES = {
  title_required: 'Nhập tên việc',
  title_too_long: 'Tên việc tối đa 200 ký tự',
} as const;

const MAX = 200;

export function validateTitle(
  raw: string,
): { ok: true; title: string } | { ok: false; error: keyof typeof TITLE_MESSAGES } {
  const title = raw.trim();
  if (!title) return { ok: false, error: 'title_required' };
  // Count characters, not UTF-16 units, so an emoji is one.
  if ([...title].length > MAX) return { ok: false, error: 'title_too_long' };
  return { ok: true, title };
}
