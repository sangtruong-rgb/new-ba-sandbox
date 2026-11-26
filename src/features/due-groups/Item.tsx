import type { Task } from '../../../web/tasks.ts';
import { useNow } from './clock.ts';
import { clockTime, dayLabel, groupOf } from './due.ts';
import s from './due.module.css';

/** What a row says about its due time; null for a done task or one without a due time. */
function useDue(task: Task) {
  const now = useNow();
  if (task.done || !task.dueAt) return null;
  const due = new Date(task.dueAt);
  const group = groupOf(task, now);
  return {
    day: group === 'today' ? null : dayLabel(due, now),
    time: clockTime(due),
    className: group === 'over' ? s.over : undefined,
  };
}

export function ItemTime({ task }: { task: Task }) {
  const due = useDue(task);
  if (!due) return null;
  return (
    <span className={due.className}>
      {due.day && <small className={s.day}>{due.day}</small>}
      {due.time}
    </span>
  );
}

export function ItemSub({ task }: { task: Task }) {
  const due = useDue(task);
  if (!due) return null;
  return <span className={due.className}>{due.day ? `${due.day} · ${due.time}` : due.time}</span>;
}
