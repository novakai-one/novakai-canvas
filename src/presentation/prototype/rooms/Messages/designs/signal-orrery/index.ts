import type { MessagesDesign } from '../../messages-design';
import { MessagesSignalOrrery } from './MessagesSignalOrrery';

/** The monumental orbital chronology alternative for the Messages Room. */
export const signalOrreryDesign = {
  id: 'signal-orrery',
  label: 'Signal Orrery',
  ownsInspector: true,
  View: MessagesSignalOrrery,
} satisfies MessagesDesign;
