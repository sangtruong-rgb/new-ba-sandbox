import { describe, expect, test } from 'vitest';
import { SLOT_NAMES, checkFeatureUis, slotComponents, type FeatureUi } from './registry.ts';

const A = () => null;
const B = () => null;

describe('FeatureUi registry', () => {
  test('C4 has the eleven slots of the contract', () => {
    expect(SLOT_NAMES).toEqual([
      'gate', 'account', 'rail', 'summary', 'input', 'list-empty',
      'item-time', 'item-lead', 'item-sub', 'detail', 'detail-actions',
    ]);
  });

  test('C4 a storage key declared by two features throws, naming both', () => {
    const f: FeatureUi[] = [
      { id: 'filter', slots: {}, storageKeys: ['todo.filter'] },
      { id: 'sort', slots: {}, storageKeys: ['todo.sort', 'todo.filter'] },
    ];
    expect(() => checkFeatureUis(f)).toThrow(/Storage key "todo.filter".*"filter".*"sort"/);
  });

  test('C4 a shortcut declared by two features throws, naming both', () => {
    const f: FeatureUi[] = [
      { id: 'add-task', slots: {}, shortcuts: ['n'] },
      { id: 'notes', slots: {}, shortcuts: ['n'] },
    ];
    expect(() => checkFeatureUis(f)).toThrow(/Shortcut "n".*"add-task".*"notes"/);
  });

  test('C4 distinct keys and shortcuts pass, ordered by order then id', () => {
    const f: FeatureUi[] = [
      { id: 'b', slots: { rail: B }, storageKeys: ['x'] },
      { id: 'a', slots: { rail: A }, shortcuts: ['x'], order: 5 },
      { id: 'c', slots: {}, order: -1 },
    ];
    const sorted = checkFeatureUis(f);
    expect(sorted.map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(slotComponents(sorted, 'rail')).toEqual([B, A]);
    expect(slotComponents(sorted, 'detail')).toEqual([]);
  });
});
