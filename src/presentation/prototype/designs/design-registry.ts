import type { RoomDesign } from './room-design';

type DesignRegistry<DesignProps> = {
  readonly defaultDesignId: string;
  list(): readonly RoomDesign<DesignProps>[];
  resolve(requestedId?: string | null): RoomDesign<DesignProps>;
};

function findDuplicateDesignId<DesignProps>(
  designs: readonly RoomDesign<DesignProps>[],
): string | null {
  const registeredIds = new Set<string>();

  for (const design of designs) {
    if (registeredIds.has(design.id)) return design.id;
    registeredIds.add(design.id);
  }

  return null;
}

/** Creates an immutable registry with unique IDs and a deliberate fallback design. */
export function createDesignRegistry<DesignProps>(
  designs: readonly RoomDesign<DesignProps>[],
  defaultDesignId: string,
): DesignRegistry<DesignProps> {
  const registeredDesigns = Object.freeze([...designs]);
  const duplicateDesignId = findDuplicateDesignId(registeredDesigns);

  if (duplicateDesignId) {
    throw new Error(`Room design ID "${duplicateDesignId}" is registered more than once.`);
  }

  const defaultDesign = registeredDesigns.find((design) => design.id === defaultDesignId);
  if (!defaultDesign) {
    throw new Error(`Default Room design "${defaultDesignId}" is not registered.`);
  }

  return {
    defaultDesignId,
    list: () => registeredDesigns,
    resolve: (requestedId) => (
      registeredDesigns.find((design) => design.id === requestedId) ?? defaultDesign
    ),
  };
}
