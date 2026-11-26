import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError, api, useTasks } from '../../../web/tasks.ts';
import s from './AddTask.module.css';
import { DueFields, parseDue } from './DueFields.tsx';
import { TITLE_MESSAGES, validateTitle } from './title.ts';

const NARROW = '(max-width: 600px)';

function useNarrow(): boolean {
  return useSyncExternalStore(
    (changed) => {
      const media = window.matchMedia?.(NARROW);
      media?.addEventListener('change', changed);
      return () => media?.removeEventListener('change', changed);
    },
    () => window.matchMedia?.(NARROW).matches ?? false,
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

function dueLabel(date: string, time: string): string {
  const due = parseDue(date, time);
  if (!due.ok || due.dueAt === null) return 'Hạn: chưa đặt';
  const at = new Date(due.dueAt);
  return `Hạn: ${pad(at.getDate())}/${pad(at.getMonth() + 1)} · ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function AddTask() {
  const { reload } = useTasks();
  const narrow = useNarrow();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [picking, setPicking] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [dueError, setDueError] = useState('');
  const [saving, setSaving] = useState(false);
  // A ref, because a second Enter can arrive before the state re-renders.
  const busy = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const dueButton = useRef<HTMLButtonElement>(null);
  const duePick = useRef<HTMLDivElement>(null);
  const focusNext = useRef<'date' | 'button' | null>(null);

  useEffect(() => {
    if (focusNext.current === 'date') duePick.current?.querySelector('input')?.focus();
    if (focusNext.current === 'button') dueButton.current?.focus();
    focusNext.current = null;
  }, [picking]);

  const openDue = () => {
    focusNext.current = 'date';
    setPicking(true);
  };

  const onDueKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    focusNext.current = 'button';
    setPicking(false);
    setDueError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    const name = validateTitle(title);
    const due = parseDue(date, time);
    setTitleError(name.ok ? '' : TITLE_MESSAGES[name.error]);
    setDueError(due.ok ? '' : due.error);
    // The fields in error must be on screen.
    if (!due.ok) setPicking(true);
    if (!name.ok || !due.ok) return;

    busy.current = true;
    setSaving(true);
    try {
      await api('/tasks', { method: 'POST', body: { title: name.title, dueAt: due.dueAt } });
      await reload();
      setTitle('');
      setDate('');
      setTime('');
      setPicking(false);
      titleInput.current?.focus();
    } catch (err) {
      // What was typed stays; api() shows the error line for a server or network failure.
      if (!(err instanceof ApiError)) throw err;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className={s.add}>
        <input
          ref={titleInput}
          type="text"
          className={s.title}
          aria-label="Thêm việc"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? 'add-task-title-error' : undefined}
          placeholder={narrow ? 'Thêm việc…' : 'Thêm việc, ví dụ: Gọi cho anh Hải về hợp đồng'}
          autoComplete="off"
          readOnly={saving}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {picking ? (
          <div ref={duePick} className={dueError ? `${s.due} ${s.invalid}` : s.due} onKeyDown={onDueKey}>
            <DueFields
              variant="inline"
              date={date}
              time={time}
              onChange={(d, t) => {
                if (busy.current) return;
                setDate(d);
                setTime(t);
              }}
              onBlur={() => {}}
            />
          </div>
        ) : (
          <button
            ref={dueButton}
            type="button"
            className={date ? `${s.due} ${s.dueButton} ${s.set}` : `${s.due} ${s.dueButton}`}
            aria-expanded="false"
            onClick={openDue}
          >
            {dueLabel(date, time)}
          </button>
        )}
        <button type="submit" className={s.submit}>
          Thêm
        </button>
        {titleError && (
          <p id="add-task-title-error" className={`${s.error} ${s.titleError}`} role="alert">
            {titleError}
          </p>
        )}
      </div>
      {dueError && (
        <p className={s.error} role="alert">
          {dueError}
        </p>
      )}
    </form>
  );
}
