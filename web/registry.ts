import type { ComponentType } from 'react';

export type SlotName =
  | 'gate'
  | 'account'
  | 'rail'
  | 'summary'
  | 'input'
  | 'list-empty'
  | 'item-time'
  | 'item-lead'
  | 'item-sub'
  | 'detail'
  | 'detail-actions';

export const SLOT_NAMES: SlotName[] = [
  'gate',
  'account',
  'rail',
  'summary',
  'input',
  'list-empty',
  'item-time',
  'item-lead',
  'item-sub',
  'detail',
  'detail-actions',
];

/** What src/features/<name>/index.ts default-exports. Props per slot: see web/shell/Shell.tsx. */
export type FeatureUi = {
  id: string;
  slots: Partial<Record<SlotName, ComponentType<any>>>;
  /** Lower draws first inside a slot (and wraps outermost in gate). Default 0, then by id. */
  order?: number;
  storageKeys?: string[];
  shortcuts?: string[];
};

/** Throws when a storage key or shortcut is declared by two features, naming both; returns the features in drawing order. */
export function checkFeatureUis(features: FeatureUi[]): FeatureUi[] {
  for (const kind of ['storageKeys', 'shortcuts'] as const) {
    const label = kind === 'storageKeys' ? 'Storage key' : 'Shortcut';
    const owners = new Map<string, string>();
    for (const f of features) {
      for (const key of f[kind] ?? []) {
        const owner = owners.get(key);
        if (owner !== undefined) {
          throw new Error(`${label} "${key}" is declared by both "${owner}" and "${f.id}"`);
        }
        owners.set(key, f.id);
      }
    }
  }
  return [...features].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}

/** Every src/features/<name>/index.ts. */
export function discoverFeatureUis(): FeatureUi[] {
  const modules = import.meta.glob<{ default: FeatureUi }>('../src/features/*/index.ts', { eager: true });
  return Object.keys(modules)
    .sort()
    .map((file) => modules[file]!.default);
}

let loaded: FeatureUi[] | null = null;

/** The app's features, checked and in drawing order (loaded once). */
export function featureUis(): FeatureUi[] {
  if (!loaded) loaded = checkFeatureUis(discoverFeatureUis());
  return loaded;
}

export function slotComponents(features: FeatureUi[], slot: SlotName): ComponentType<any>[] {
  return features.flatMap((f) => (f.slots[slot] ? [f.slots[slot]] : []));
}
