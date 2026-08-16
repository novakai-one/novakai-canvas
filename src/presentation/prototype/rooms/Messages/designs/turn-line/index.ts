import type { MessagesDesign } from '../../messages-design';
import { MessagesTurnLine } from './MessagesTurnLine';

export const turnLineDesign = {
  id: 'turn-line',
  label: 'Turn Line',
  ownsInspector: true,
  View: MessagesTurnLine,
} satisfies MessagesDesign;
