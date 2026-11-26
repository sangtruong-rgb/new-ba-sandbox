import type { FeatureUi } from '../../../web/registry.ts';
import { AddTask } from './AddTask.tsx';

const feature: FeatureUi = { id: 'add-task', slots: { input: AddTask } };

export default feature;
