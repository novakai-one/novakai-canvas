/**
 * Branded identifiers.
 *
 * Every durable object is addressed by an opaque ID that cannot be swapped for another kind of
 * ID, and nothing ever parses one for meaning. Labels are presentation data: the moment a name
 * becomes a join, renaming a diagram breaks the links pointing at it.
 */

declare const brand: unique symbol;

type Branded<Tag extends string> = string & { readonly [brand]: Tag };

/** Identifies one independently stored diagram record. Survives rename, archive, and restore. */
export type DiagramId = Branded<'DiagramId'>;

/** Identifies one drawn occurrence inside one diagram. Unique within its diagram, not globally. */
export type NodeId = Branded<'NodeId'>;

/** Identifies one relationship inside one diagram. Preserved across endpoint reconnection. */
export type WireId = Branded<'WireId'>;

/** Identifies one interface (method signature) owned by a node. */
export type InterfaceId = Branded<'InterfaceId'>;

/** Identifies one shared type definition. */
export type TypeId = Branded<'TypeId'>;

/** Identifies one saved arrangement of a diagram. */
export type LayoutId = Branded<'LayoutId'>;

/** Identifies one saved reading view of a diagram. */
export type ViewId = Branded<'ViewId'>;

/** Identifies one relationship whose ends live in different diagrams. Owned by the library. */
export type LinkId = Branded<'LinkId'>;

/** Any identifier this capability mints. */
export type CanvasId =
  | DiagramId | NodeId | WireId | InterfaceId | TypeId | LayoutId | ViewId | LinkId;

/**
 * Marks an untrusted string as an identifier of one kind.
 *
 * Used only at parsing seams, where a validator has already established the string is a
 * non-empty identifier. Domain code never calls this to invent an identity out of a label.
 */
export function asId<Id extends CanvasId>(value: string): Id {
  return value as Id;
}
