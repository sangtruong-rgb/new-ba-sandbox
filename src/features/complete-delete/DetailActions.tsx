import { useSelection, type Task } from '../../../web/tasks.ts';
import { deleteTask, toggleDone } from './actions.ts';
import s from './CompleteDelete.module.css';

/** The action row of the selected task (slot detail-actions). */
export function DetailActions({ task }: { task: Task }) {
  const [, select] = useSelection();
  return (
    <>
      <button type="button" className={s.link} onClick={() => void toggleDone(task)}>
        {task.done ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong'}
      </button>
      <button type="button" className={`${s.link} ${s.del}`} onClick={() => void deleteTask(task, () => select(null))}>
        Xóa việc
      </button>
    </>
  );
}
