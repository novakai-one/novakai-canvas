import type { MessagesDesign } from '../../messages-design';
import { MessagesGravityWell } from './MessagesGravityWell';

export const gravityWellDesign = {
  id: 'gravity-well',
  label: 'Gravity Well',
  ownsInspector: true,
  View: MessagesGravityWell,
} satisfies MessagesDesign;
