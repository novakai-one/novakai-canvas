import type { MessagesDesign } from '../../messages-design';
import { MessagesStandingWave } from './MessagesStandingWave';

/** One shared clock; every conversation read as a trace against it. */
export const standingWaveDesign = {
  id: 'standing-wave',
  label: 'Standing Wave',
  ownsInspector: true,
  View: MessagesStandingWave,
} satisfies MessagesDesign;
