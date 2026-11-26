import { useEffect } from 'react';
import { setListArrangement } from '../../../web/list.ts';
import { useTasks } from '../../../web/tasks.ts';
import { useNow } from './clock.ts';
import { arrangeByDue, dateLine, heading } from './due.ts';
import s from './due.module.css';

/** The list header. Always on the list page, so it also keeps the list arranged by due time. */
export function Summary() {
  const { tasks } = useTasks();
  const now = useNow();
  const minute = now.getTime();

  // Set again each minute so the groups change together with the rows and the heading. The
  // shell's own `now` can be up to a minute old, so the arrangement reads the clock itself.
  useEffect(() => {
    setListArrangement((rows) => arrangeByDue(rows, new Date()));
  }, [minute]);

  return (
    <>
      <div className={s.date}>{dateLine(now)}</div>
      <h1 className={s.heading}>{heading(tasks, now)}</h1>
    </>
  );
}
