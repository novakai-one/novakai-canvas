import type { ObjectRoomDesign } from '../../object-room-design';
import { CurrentObjectRoom } from './CurrentObjectRoom';

export const currentObjectRoomDesign = {
  id: 'current',
  label: 'Current Object Room',
  View: CurrentObjectRoom,
} satisfies ObjectRoomDesign;
