import type { CanvasId } from './ids.ts';

/**
 * Marks an already-validated string as an identifier of one kind.
 *
 * Lives apart from the identifier types themselves so that `ids.ts` stays a pure type
 * contract. Used only at parsing and migration seams, where a validator has established the
 * string is a non-empty identifier — never to invent an identity out of a label.
 */
export function asId<Id extends CanvasId>(value: string): Id {
  return value as Id;
}
