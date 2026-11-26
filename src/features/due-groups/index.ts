import type { FeatureUi } from '../../../web/registry.ts';
import { ItemSub, ItemTime } from './Item.tsx';
import { Summary } from './Summary.tsx';

const feature: FeatureUi = {
  id: 'due-groups',
  slots: { summary: Summary, 'item-time': ItemTime, 'item-sub': ItemSub },
};

export default feature;
