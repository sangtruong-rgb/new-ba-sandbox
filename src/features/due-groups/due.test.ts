import { describe, expect, test } from 'vitest';
import { task } from '../../../web/test-support.tsx';
import { arrangeByDue, clockTime, dateLine, dayLabel, groupOf, heading } from './due.ts';

// Local times, so the tests hold in any time zone.
const NOW = new Date(2026, 10, 26, 14, 20, 30);
const at = (month: number, day: number, h = 12, m = 0, year = 2026) => new Date(year, month - 1, day, h, m).toISOString();

describe('due groups', () => {
  test('C33 the groups come in order with their titles', () => {
    expect(arrangeByDue([], NOW).map((g) => g.title)).toEqual(['Quá hạn', 'Hôm nay', 'Sắp tới', 'Không có hạn', 'Đã xong']);
  });

  test('C34 overdue is compared to the minute; the rest of today and later days are apart', () => {
    const of = (dueAt: string) => groupOf(task({ dueAt }), NOW);
    expect(of(at(11, 26, 14, 19))).toBe('over');
    expect(of(at(11, 25, 23, 59))).toBe('over');
    expect(of(at(11, 26, 14, 20))).toBe('today');
    expect(of(at(11, 26, 23, 59))).toBe('today');
    expect(of(at(11, 27, 0, 0))).toBe('soon');
    expect(groupOf(task({ dueAt: at(11, 1), done: true }), NOW)).toBe('done');
    expect(arrangeByDue([], NOW).filter((g) => g.tone === 'alert').map((g) => g.id)).toEqual(['over']);
  });

  test('C35 due groups sort by due time, no-due oldest first, done latest first', () => {
    const tasks = [
      task({ title: 'over2', dueAt: at(11, 26, 9) }),
      task({ title: 'over1', dueAt: at(11, 25) }),
      task({ title: 'today2', dueAt: at(11, 26, 20) }),
      task({ title: 'today1', dueAt: at(11, 26, 15) }),
      task({ title: 'soon2', dueAt: at(12, 1) }),
      task({ title: 'soon1', dueAt: at(11, 28) }),
      task({ title: 'none2', createdAt: at(11, 20) }),
      task({ title: 'none1', createdAt: at(11, 10) }),
      task({ title: 'done2', done: true, doneAt: at(11, 24) }),
      task({ title: 'done1', done: true, doneAt: at(11, 26) }),
    ];
    expect(arrangeByDue(tasks, NOW).map((g) => g.tasks.map((t) => t.title))).toEqual([
      ['over1', 'over2'],
      ['today1', 'today2'],
      ['soon1', 'soon2'],
      ['none1', 'none2'],
      ['done1', 'done2'],
    ]);
  });

  test('C36 the day label is relative, else weekday and date, with the year when not this year', () => {
    const label = (iso: string) => dayLabel(new Date(iso), NOW);
    expect(label(at(11, 25, 23, 59))).toBe('Hôm qua');
    expect(label(at(11, 26, 0, 0))).toBe('Hôm nay');
    expect(label(at(11, 27, 0, 0))).toBe('Ngày mai');
    expect(label(at(11, 28))).toBe('T7 28/11');
    expect(label(at(11, 29))).toBe('CN 29/11');
    expect(label(at(12, 1))).toBe('T3 01/12');
    expect(label(at(11, 28, 12, 0, 2027))).toBe('CN 28/11/2027');
    expect(clockTime(new Date(at(11, 26, 9, 5)))).toBe('09:05');
  });

  test('C38 the date line and each heading', () => {
    expect(dateLine(NOW)).toBe('Thứ Năm · 26 tháng 11');
    const open = task({ dueAt: at(12, 1) });
    const late = task({ dueAt: at(11, 25) });
    const done = task({ done: true, dueAt: at(11, 25) });
    expect(heading([open, late, done], NOW)).toBe('Còn 2 việc, 1 việc đã quá hạn');
    expect(heading([open, done], NOW)).toBe('Còn 1 việc');
    expect(heading([done], NOW)).toBe('Không còn việc nào');
    expect(heading([], NOW)).toBe('Chưa có việc nào');
  });
});
