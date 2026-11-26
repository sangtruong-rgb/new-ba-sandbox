import type { FeatureUi } from '../../../web/registry.ts';
import { Account } from './Account.tsx';
import { Gate } from './Gate.tsx';

const ui: FeatureUi = {
  id: 'account',
  slots: { gate: Gate, account: Account },
};

export default ui;
