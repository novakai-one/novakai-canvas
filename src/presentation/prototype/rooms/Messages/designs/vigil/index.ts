import type { MessagesDesign } from '../../messages-design';
import { MessagesVigil } from './MessagesVigil';

/** Vigil: conversations seated on the floor at the distance of their silence. */
export const vigilDesign = {
  id: 'vigil',
  label: 'Vigil',
  ownsInspector: true,
  View: MessagesVigil,
} satisfies MessagesDesign;
