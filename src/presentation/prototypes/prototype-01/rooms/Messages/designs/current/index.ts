import type { MessagesDesign } from '../../messages-design';
import { CurrentMessages } from './CurrentMessages';

export const currentMessagesDesign = {
  id: 'current',
  label: 'Current Messages',
  View: CurrentMessages,
} satisfies MessagesDesign;
