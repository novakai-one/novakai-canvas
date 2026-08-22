import { z } from 'zod';

export const WIRE_CARDINALITIES = [
  'one', 'zero-or-one', 'one-or-many', 'zero-or-many',
] as const;

export type WireCardinality = typeof WIRE_CARDINALITIES[number];
export const wireCardinalitySchema = z.enum(WIRE_CARDINALITIES);
export const WIRE_CARDINALITY_LABELS: Record<WireCardinality, string> = {
  one: 'Exactly one',
  'zero-or-one': 'Zero or one',
  'one-or-many': 'One or many',
  'zero-or-many': 'Zero or many',
};
