import type { FeatureUi } from '../../../web/registry.ts';
import { STORAGE_KEY } from './filter.ts';
import { ListEmpty } from './ListEmpty.tsx';
import { StatusFilter } from './StatusFilter.tsx';

const feature: FeatureUi = {
  id: 'status-filter',
  slots: { rail: StatusFilter, 'list-empty': ListEmpty },
  storageKeys: [STORAGE_KEY],
};

export default feature;
