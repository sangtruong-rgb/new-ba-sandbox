/**
 * The page frame. Slots and the props each receives:
 * - gate: { children }, wraps the whole page; with no feature in it, children render.
 * - account: no props. Bottom of the left rail (wide); in the top bar beside the brand (600px and below).
 * - rail: no props. Top of the left rail under the brand (wide); a row above the add field (600px and below).
 * - summary: no props. The header of the list column: date line and heading.
 * - input: no props. Under the header, above the list.
 * - list-empty: no props. In place of the list when no row is left after filtering.
 * - item-time: { task }. The row's left margin, before item-lead, shown from 1100px.
 * - item-lead: { task }. Between item-time and the title; a click inside it does not select the row.
 * - item-sub: { task }. The line under the row's title, shown only below 1100px.
 * - detail: { task: Task | null }. The right pane (1100px and wider); narrower, it replaces the list
 *   while a task is selected, under the link '‹ Danh sách'.
 * - detail-actions: { task }. Under detail, only while a task is selected.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type MouseEvent,
} from 'react';
import { arrangeTasks, useListView, type Group } from '../list.ts';
import { featureUis, slotComponents, type FeatureUi, type SlotName } from '../registry.ts';
import { useSelection, useShellError, useTasks, type Task } from '../tasks.ts';
import s from './Shell.module.css';

export const REARRANGE_MS = 60_000;

const Features = createContext<FeatureUi[]>([]);

type SlotProps = {
  name: SlotName;
  props?: Record<string, unknown>;
  className?: string;
  as?: 'div' | 'span';
};

/** Draws every feature's component for the slot, in order, inside one element marked data-slot. */
export function Slot({ name, props = {}, className, as: El = 'div' }: SlotProps) {
  const comps = slotComponents(useContext(Features), name);
  return (
    <El data-slot={name} className={className}>
      {comps.map((C, i) => (
        <C key={i} {...props} />
      ))}
    </El>
  );
}

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const m = window.matchMedia(query);
    m.addEventListener('change', cb);
    return () => m.removeEventListener('change', cb);
  };
}

function useMedia(query: string): boolean {
  const subscribe = useMemo(() => subscribeMedia(query), [query]);
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

const Brand = () => <div className={s.brand}>Việc.</div>;

function ErrorLine() {
  const error = useShellError();
  if (!error) return null;
  return (
    <p className={s.errorLine} role="alert">
      {error}
    </p>
  );
}

function Row({ task, selected, onSelect }: { task: Task; selected: boolean; onSelect: (id: string) => void }) {
  const lead = useRef<HTMLSpanElement>(null);
  const onClick = (e: MouseEvent) => {
    if (lead.current?.contains(e.target as Node)) return;
    onSelect(task.id);
  };
  return (
    <li
      className={[s.row, task.done ? s.done : ''].join(' ')}
      aria-selected={selected ? 'true' : 'false'}
      data-task-id={task.id}
      onClick={onClick}
    >
      <Slot name="item-time" as="span" className={s.time} props={{ task }} />
      <span ref={lead} className={s.lead}>
        <Slot name="item-lead" as="span" props={{ task }} />
      </span>
      <button type="button" className={s.rowbtn} aria-current={selected ? 'true' : undefined}>
        <span className={s.title}>{task.title}</span>
        <Slot name="item-sub" as="span" className={s.sub} props={{ task }} />
      </button>
    </li>
  );
}

function GroupView({ group, selected, onSelect }: { group: Group; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <section className={s.group} data-group={group.id}>
      {group.title && (
        <h2 className={group.tone === 'alert' ? `${s.groupTitle} ${s.alert}` : s.groupTitle}>
          {group.title}
          <small>{group.tasks.length}</small>
        </h2>
      )}
      <ul className={s.tasks}>
        {group.tasks.map((t) => (
          <Row key={t.id} task={t} selected={t.id === selected} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
}

function TaskList() {
  const { tasks } = useTasks();
  const view = useListView();
  const [selected, select] = useSelection();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), REARRANGE_MS);
    return () => clearInterval(timer);
  }, []);
  const groups = useMemo(() => arrangeTasks(tasks, now, view), [tasks, now, view]);
  if (groups.length === 0) return <Slot name="list-empty" />;
  return (
    <>
      {groups.map((g) => (
        <GroupView key={g.id} group={g} selected={selected} onSelect={select} />
      ))}
    </>
  );
}

function Frame() {
  const { tasks } = useTasks();
  const [selected, select] = useSelection();
  const task = (selected && tasks.find((t) => t.id === selected)) || null;
  const narrow = useMedia('(max-width: 600px)');

  return (
    <div className={task ? `${s.app} ${s.sel}` : s.app}>
      {!narrow && (
        <nav className={s.rail} aria-label="Thanh bên">
          <Brand />
          <Slot name="rail" />
          <Slot name="account" className={s.account} />
        </nav>
      )}
      <main className={s.main}>
        <ErrorLine />
        {narrow && (
          <div className={s.top}>
            <Brand />
            <Slot name="account" className={s.topAccount} />
          </div>
        )}
        <Slot name="summary" />
        {narrow && <Slot name="rail" className={s.railRow} />}
        <Slot name="input" />
        <div className={s.listwrap}>
          <TaskList />
        </div>
      </main>
      <aside className={s.pane}>
        {task && (
          <button type="button" className={s.back} onClick={() => select(null)}>
            ‹ Danh sách
          </button>
        )}
        <Slot name="detail" props={{ task }} />
        {task && <Slot name="detail-actions" className={s.actions} props={{ task }} />}
      </aside>
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const gates = slotComponents(useContext(Features), 'gate');
  return gates.reduceRight<ReactNode>((inner, G) => <G>{inner}</G>, children);
}

/** The whole page; `features` defaults to every src/features/<name>/index.ts. */
export function Shell({ features }: { features?: FeatureUi[] }) {
  const list = useMemo(() => features ?? featureUis(), [features]);
  return (
    <Features.Provider value={list}>
      <Gate>
        <Frame />
      </Gate>
    </Features.Provider>
  );
}

export default Shell;
