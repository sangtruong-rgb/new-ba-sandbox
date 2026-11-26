import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { parseDue } from './DueFields.tsx';

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Asia/Ho_Chi_Minh';
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const invalid = { ok: false, error: 'Ngày giờ không hợp lệ' };

describe('parseDue', () => {
  test('C25 C23 reads dd/mm/yyyy HH:mm and d/m/yyyy H:mm in the user’s time zone', () => {
    expect(parseDue('28/11/2026', '23:59')).toEqual({ ok: true, dueAt: '2026-11-28T16:59:00.000Z' });
    expect(parseDue('5/1/2027', '9:05')).toEqual({ ok: true, dueAt: '2027-01-05T02:05:00.000Z' });
  });

  test('C25 C23 both empty is no due', () => {
    expect(parseDue('', '')).toEqual({ ok: true, dueAt: null });
  });

  test('C25 C23 a date alone is 23:59 of that day', () => {
    expect(parseDue('28/11/2026', '')).toEqual({ ok: true, dueAt: '2026-11-28T16:59:00.000Z' });
  });

  test('C25 C23 a time without a date asks for the date', () => {
    expect(parseDue('', '10:00')).toEqual({ ok: false, error: 'Chọn ngày cho hạn chót' });
  });

  test('C25 C23 a date or time that does not exist is invalid', () => {
    for (const [d, t] of [
      ['31/02/2026', ''],
      ['29/02/2027', ''],
      ['1/13/2026', ''],
      ['0/1/2026', ''],
      ['28/11/2026', '25:00'],
      ['28/11/2026', '24:00'],
      ['28/11/2026', '10:60'],
    ] as const) {
      expect(parseDue(d, t), `${d} ${t}`).toEqual(invalid);
    }
  });

  test('C25 C23 any other format is invalid', () => {
    for (const [d, t] of [
      ['2026-11-28', ''],
      ['28/11/26', ''],
      ['28/11', ''],
      ['mai', ''],
      ['28/11/2026', '9'],
      ['28/11/2026', '9:5'],
      ['28/11/2026', '9h30'],
    ] as const) {
      expect(parseDue(d, t), `${d} ${t}`).toEqual(invalid);
    }
  });

  test('C25 C23 a past date is allowed', () => {
    expect(parseDue('29/02/2024', '0:00')).toEqual({ ok: true, dueAt: '2024-02-28T17:00:00.000Z' });
  });
});
