import type { MessagesDesign } from '../../messages-design';
import { MessagesCatenary } from './MessagesCatenary';

/** Conversations as cables under load: waiting sags, replying releases. */
export const catenaryDesign = {
  id: 'catenary',
  label: 'Catenary',
  ownsInspector: true,
  View: MessagesCatenary,
} satisfies MessagesDesign;
