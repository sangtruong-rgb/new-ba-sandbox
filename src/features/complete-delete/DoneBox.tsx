import type { Task } from '../../../web/tasks.ts';
import { toggleDone } from './actions.ts';
import s from './CompleteDelete.module.css';

/** The square before a task's title (slot item-lead). */
export function DoneBox({ task }: { task: Task }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={task.done}
      aria-label={`Đánh dấu xong: ${task.title}`}
      className={s.box}
      onClick={() => void toggleDone(task)}
    >
      {task.done && (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
