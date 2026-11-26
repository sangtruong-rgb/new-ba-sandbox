import { useListCounts } from '../../../web/list.ts';
import { selectFilter, useFilter, type Filter } from './filter.ts';
import s from './StatusFilter.module.css';

const OPTIONS: [Filter, string][] = [
  ['all', 'Tất cả'],
  ['open', 'Chưa xong'],
  ['done', 'Đã xong'],
];

/** Slot rail: a column in the left rail, a row of chips at 600px and below. */
export function StatusFilter() {
  const selected = useFilter();
  const counts = useListCounts();
  return (
    <div className={s.filters}>
      {OPTIONS.map(([filter, label]) => (
        <button
          key={filter}
          type="button"
          aria-current={filter === selected ? 'page' : undefined}
          onClick={() => selectFilter(filter)}
        >
          {label} <b>{counts[filter]}</b>
        </button>
      ))}
    </div>
  );
}
