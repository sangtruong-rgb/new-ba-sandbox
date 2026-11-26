import { useListCounts } from '../../../web/list.ts';
import { useFilter } from './filter.ts';
import s from './StatusFilter.module.css';

/** Slot list-empty: says why no row is left. */
export function ListEmpty() {
  const filter = useFilter();
  const { all } = useListCounts();
  const message =
    all === 0
      ? 'Viết việc đầu tiên vào ô phía trên.'
      : filter === 'open'
        ? 'Không còn việc nào chưa xong.'
        : 'Chưa có việc nào xong.';
  return <p className={s.empty}>{message}</p>;
}
