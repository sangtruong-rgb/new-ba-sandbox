import type { FeatureUi } from '../../../web/registry.ts';
import { DetailActions } from './DetailActions.tsx';
import { DoneBox } from './DoneBox.tsx';

const feature: FeatureUi = {
  id: 'complete-delete',
  slots: { 'item-lead': DoneBox, 'detail-actions': DetailActions },
};

export default feature;
