import { createDesignRegistry } from '../../designs/design-registry';
import { currentObjectRoomDesign } from './designs/current';
import type { ObjectRoomDesign, ObjectRoomDesignProps } from './object-room-design';

const objectRoomDesignRegistry = createDesignRegistry<ObjectRoomDesignProps>(
  [currentObjectRoomDesign],
  currentObjectRoomDesign.id,
);

/** Resolves the URL design ID with a deliberate fallback to the current reading layout. */
export function resolveObjectRoomDesign(search: string): ObjectRoomDesign {
  const requestedId = new URLSearchParams(search).get('objectRoomDesign');
  return objectRoomDesignRegistry.resolve(requestedId);
}
