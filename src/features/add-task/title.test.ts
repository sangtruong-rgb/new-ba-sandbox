import { describe, expect, test } from 'vitest';
import { TITLE_MESSAGES, validateTitle } from './title.ts';

describe('TitleRule', () => {
  test('C25 TITLE_MESSAGES holds the two messages', () => {
    expect(TITLE_MESSAGES).toEqual({
      title_required: 'Nhập tên việc',
      title_too_long: 'Tên việc tối đa 200 ký tự',
    });
  });

  test('C25 C21 empty or only whitespace is title_required', () => {
    for (const raw of ['', '   ', '\n\t ']) {
      expect(validateTitle(raw)).toEqual({ ok: false, error: 'title_required' });
    }
  });

  test('C25 C21 the title comes back trimmed', () => {
    expect(validateTitle('  Mua sữa  ')).toEqual({ ok: true, title: 'Mua sữa' });
  });

  test('C25 C21 200 characters after trimming pass, 201 are title_too_long', () => {
    expect(validateTitle(`  ${'a'.repeat(200)}  `)).toEqual({ ok: true, title: 'a'.repeat(200) });
    expect(validateTitle('a'.repeat(201))).toEqual({ ok: false, error: 'title_too_long' });
    expect(validateTitle('😀'.repeat(200)).ok).toBe(true);
  });
});
