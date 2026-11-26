import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTasks, type Task } from '../../../web/tasks.ts';
import { DueFields, parseDue } from '../add-task/DueFields.tsx';
import { TITLE_MESSAGES, validateTitle } from '../add-task/title.ts';
import s from './EditTask.module.css';
import { released, saveTask } from './save.ts';

type Due = { date: string; time: string };

const pad = (n: number) => String(n).padStart(2, '0');

function dueFields(dueAt: string | null): Due {
  if (!dueAt) return { date: '', time: '' };
  const at = new Date(dueAt);
  return {
    date: `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}

/**
 * One field being edited. What was typed is saved by commit(); when it is not valid it stays
 * in the field with its error and is dropped if the editor goes away.
 */
function useDraft<T>(
  saved: T,
  same: (a: T, b: T) => boolean,
  check: (typed: T) => { error: string } | { value: T; save: () => Promise<boolean> },
) {
  const [draft, setDraft] = useState<T | null>(null);
  const [error, setError] = useState('');
  // Refs, because the editor commits once more as it goes away.
  const typed = useRef<T | null>(null);
  const sending = useRef<{ value: T } | null>(null);

  // What was started before a drop() must not bring back its error or its text afterwards.
  const drops = useRef(0);

  const showError = (message: string) => {
    const at = drops.current;
    void released().then(() => {
      if (drops.current === at) setError(message);
    });
  };

  const change = (value: T) => {
    typed.current = value;
    setDraft(value);
  };

  const drop = () => {
    drops.current += 1;
    typed.current = null;
    setDraft(null);
    setError('');
  };

  const commit = async () => {
    const raw = typed.current;
    if (raw === null) return;
    const result = check(raw);
    if ('error' in result) return showError(result.error);
    showError('');
    typed.current = null;
    if (same(result.value, sending.current ? sending.current.value : saved)) {
      if (!sending.current) setDraft(null);
      return;
    }
    const mine = { value: result.value };
    sending.current = mine;
    setDraft(result.value);
    const at = drops.current;
    const ok = await result.save();
    if (sending.current !== mine) return;
    sending.current = null;
    if (typed.current !== null) return;
    // A failed save keeps the text, to be tried again on the next commit.
    if (ok) setDraft(null);
    else if (drops.current === at) typed.current = raw;
  };

  return { value: draft ?? saved, error, change, drop, commit };
}

function Editor({ task }: { task: Task }) {
  const title = useDraft<string>(
    task.title,
    (a, b) => a === b,
    (raw) => {
      const name = validateTitle(raw);
      if (!name.ok) return { error: TITLE_MESSAGES[name.error] };
      return { value: name.title, save: () => saveTask(task.id, { title: name.title }) };
    },
  );
  const due = useDraft<Due>(
    dueFields(task.dueAt),
    (a, b) => a.date === b.date && a.time === b.time,
    ({ date, time }) => {
      const parsed = parseDue(date, time);
      if (!parsed.ok) return { error: parsed.error };
      return { value: dueFields(parsed.dueAt), save: () => saveTask(task.id, { dueAt: parsed.dueAt }) };
    },
  );

  const commits = useRef({ title: title.commit, due: due.commit });
  commits.current = { title: title.commit, due: due.commit };
  // Another task, "‹ Danh sách" or a delete can take the editor away before a field is left.
  useEffect(
    () => () => {
      void commits.current.title();
      void commits.current.due();
    },
    [],
  );

  const onTitleKey = (e: KeyboardEvent) => {
    // Enter and Escape also end an input method's composition.
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      void title.commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      title.drop();
    }
  };

  const clearDue = () => {
    due.drop();
    void saveTask(task.id, { dueAt: null });
  };

  return (
    <>
      <textarea
        className={s.title}
        rows={2}
        aria-label="Tên việc"
        placeholder="Tên việc"
        aria-invalid={title.error ? true : undefined}
        aria-describedby={title.error ? 'edit-task-title-error' : undefined}
        value={title.value}
        onChange={(e) => title.change(e.target.value.replace(/[\r\n]+/g, ' '))}
        onKeyDown={onTitleKey}
        onBlur={() => void title.commit()}
      />
      {title.error && (
        <p id="edit-task-title-error" className={s.error} role="alert">
          {title.error}
        </p>
      )}
      <DueFields
        variant="pane"
        date={due.value.date}
        time={due.value.time}
        onChange={(date, time) => due.change({ date, time })}
        onBlur={() => void due.commit()}
      />
      {due.error && (
        <p className={s.error} role="alert">
          {due.error}
        </p>
      )}
      {task.dueAt && (
        <button type="button" className={s.clear} onClick={clearDue}>
          Bỏ hạn
        </button>
      )}
    </>
  );
}

/** The selected task's name and due time (slot detail). */
export function Detail({ task }: { task: Task | null }) {
  const { tasks } = useTasks();
  if (task) return <Editor key={task.id} task={task} />;
  return tasks.length > 0 ? <p className={s.none}>Chọn một việc để xem và sửa</p> : null;
}
