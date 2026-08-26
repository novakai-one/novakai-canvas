import { z } from 'zod';
import type { LibraryIndex } from '../records/index.ts';
import { appliedOperationSchema } from './record-primitives.ts';
import { wireCardinalitySchema } from './wire-cardinality.ts';

const crossDiagramLink = z.object({
  id: z.string().min(1),
  kind: z.enum(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']),
  label: z.string(),
  source: z.object({
    diagramId: z.string().min(1), nodeId: z.string().min(1),
    cardinality: wireCardinalitySchema.optional(),
  }),
  target: z.object({
    diagramId: z.string().min(1), nodeId: z.string().min(1),
    cardinality: wireCardinalitySchema.optional(),
  }),
});
const libraryEntry = z.object({
  id: z.string().min(1), name: z.string(), status: z.enum(['active', 'archived']),
  revision: z.number().int().nonnegative(), nodeLabels: z.array(z.string()),
});
const schema = z.object({
  schemaVersion: z.literal(3), revision: z.number().int().nonnegative(),
  entries: z.record(z.string(), libraryEntry), links: z.record(z.string(), crossDiagramLink),
  migratedOperations: z.record(z.string(), appliedOperationSchema),
});

/** Runtime validator for the searchable index over every diagram record. */
export const libraryIndexSchema = {
  parse(input: unknown): LibraryIndex { return schema.parse(input) as LibraryIndex; },
};
