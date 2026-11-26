import type { Group } from '../../../web/list.ts';
import type { Task } from '../../../web/tasks.ts';

export type GroupId = 'over' | 'today' | 'soon' | 'none' | 'done';

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const SHORT_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const pad = (n: number) => String(n).padStart(2, '0');
const minute = (d: Date) => Math.floor(d.getTime() / 60_000);

/** Whole calendar days from `now` to `date`, in the machine's local time. */
function daysFrom(now: Date, date: Date): number {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(date) - day(now)) / 86_400_000);
}

export function groupOf(task: Task, now: Date): GroupId {
  if (task.done) return 'done';
  if (!task.dueAt) return 'none';
  const due = new Date(task.dueAt);
  if (minute(due) < minute(now)) return 'over';
  return daysFrom(now, due) === 0 ? 'today' : 'soon';
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : 0);
const byDue = (a: Task, b: Task) => time(a.dueAt) - time(b.dueAt);
const oldestFirst = (a: Task, b: Task) => time(a.createdAt) - time(b.createdAt);
const lastDoneFirst = (a: Task, b: Task) => time(b.doneAt) - time(a.doneAt);

const GROUPS: { id: GroupId; title: string; tone?: 'alert'; sort: (a: Task, b: Task) => number }[] = [
  { id: 'over', title: 'Quá hạn', tone: 'alert', sort: byDue },
  { id: 'today', title: 'Hôm nay', sort: byDue },
  { id: 'soon', title: 'Sắp tới', sort: byDue },
  { id: 'none', title: 'Không có hạn', sort: oldestFirst },
  { id: 'done', title: 'Đã xong', sort: lastDoneFirst },
];

/** All five groups in order; the shell omits the empty ones. */
export function arrangeByDue(tasks: Task[], now: Date): Group[] {
  return GROUPS.map(({ sort, ...group }) => ({
    ...group,
    tasks: tasks.filter((t) => groupOf(t, now) === group.id).sort(sort),
  }));
}

/** "Hôm qua", "Hôm nay", "Ngày mai", else "T7 28/11" (with the year when it is not this year). */
export function dayLabel(date: Date, now: Date): string {
  const days = daysFrom(now, date);
  if (days === -1) return 'Hôm qua';
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  const year = date.getFullYear() === now.getFullYear() ? '' : `/${date.getFullYear()}`;
  return `${SHORT_WEEKDAYS[date.getDay()]} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}${year}`;
}

export const clockTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** "Thứ Năm · 26 tháng 11" */
export const dateLine = (now: Date) => `${WEEKDAYS[now.getDay()]} · ${now.getDate()} tháng ${now.getMonth() + 1}`;

export function heading(tasks: Task[], now: Date): string {
  if (tasks.length === 0) return 'Chưa có việc nào';
  const open = tasks.filter((t) => !t.done).length;
  if (open === 0) return 'Không còn việc nào';
  const over = tasks.filter((t) => groupOf(t, now) === 'over').length;
  return over ? `Còn ${open} việc, ${over} việc đã quá hạn` : `Còn ${open} việc`;
}
