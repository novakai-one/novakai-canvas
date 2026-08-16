import type { MessagesDesign } from '../../messages-design';
import { MessagesRackFocus } from './MessagesRackFocus';

export const rackFocusDesign = {
  id: 'rack-focus',
  label: 'Rack Focus',
  ownsInspector: true,
  View: MessagesRackFocus,
} satisfies MessagesDesign;
