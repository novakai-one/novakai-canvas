import type { MessagesDesign } from '../../messages-design';
import { MessagesSwitchboard } from './MessagesSwitchboard';

export const switchboardDesign = {
  id: 'switchboard',
  label: 'Switchboard',
  ownsInspector: true,
  View: MessagesSwitchboard,
} satisfies MessagesDesign;
