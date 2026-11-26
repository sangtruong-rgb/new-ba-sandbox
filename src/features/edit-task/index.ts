import type { FeatureUi } from '../../../web/registry.ts';
import { Detail } from './Detail.tsx';

const feature: FeatureUi = { id: 'edit-task', slots: { detail: Detail } };

export default feature;
