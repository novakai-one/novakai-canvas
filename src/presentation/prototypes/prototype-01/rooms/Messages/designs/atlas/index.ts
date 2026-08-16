import type { MessagesDesign } from '../../messages-design';
import { MessagesAtlas } from './MessagesAtlas';

export const transcriptAtlasDesign = {
  id: 'atlas',
  label: 'Transcript Atlas',
  ownsInspector: true,
  View: MessagesAtlas,
} satisfies MessagesDesign;
