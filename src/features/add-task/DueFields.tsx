import type { FocusEvent } from 'react';
import s from './DueFields.module.css';

const MISSING_DATE = 'Chọn ngày cho hạn chót';
const INVALID = 'Ngày giờ không hợp lệ';

/** Reads the two typed fields as a due time in the user's time zone. */
export function parseDue(
  date: string,
  time: string,
): { ok: true; dueAt: string | null } | { ok: false; error: string } {
  if (!date) return time ? { ok: false, error: MISSING_DATE } : { ok: true, dueAt: null };
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
  const t = time ? /^(\d{1,2}):(\d{2})$/.exec(time) : ['', '23', '59'];
  if (!d || !t) return { ok: false, error: INVALID };
  const [day, month, year] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hour, minute] = [Number(t[1]), Number(t[2])];
  const at = new Date(0);
  at.setFullYear(year, month - 1, day);
  at.setHours(hour, minute, 0, 0);
  // Date rolls 31/02 or 25:00 over to another moment; such a date or time does not exist.
  const exists =
    at.getFullYear() === year &&
    at.getMonth() === month - 1 &&
    at.getDate() === day &&
    at.getHours() === hour &&
    at.getMinutes() === minute;
  return exists ? { ok: true, dueAt: at.toISOString() } : { ok: false, error: INVALID };
}

type Props = {
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
  onBlur: () => void;
  variant: 'inline' | 'pane';
};

export function DueFields({ date, time, onChange, onBlur, variant }: Props) {
  const pane = variant === 'pane';
  const leave = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) onBlur();
  };
  const fields = (
    <div className={pane ? s.pane : s.inline} onBlur={leave}>
      <input
        type="text"
        className={s.date}
        aria-label={pane ? 'Ngày hạn chót' : 'Ngày'}
        placeholder="dd/mm/yyyy"
        autoComplete="off"
        value={date}
        onChange={(e) => onChange(e.target.value, time)}
      />
      <input
        type="text"
        className={s.time}
        aria-label={pane ? 'Giờ hạn chót' : 'Giờ'}
        placeholder="hh:mm"
        autoComplete="off"
        value={time}
        onChange={(e) => onChange(date, e.target.value)}
      />
    </div>
  );
  if (!pane) return fields;
  return (
    <>
      <div className={s.label}>Hạn chót</div>
      {fields}
    </>
  );
}
