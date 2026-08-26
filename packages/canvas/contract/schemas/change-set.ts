import { z } from 'zod';
import type { CanvasChangeSet } from '../records/legacy-commands.ts';
import {
  LEGACY_KINDS, legacyActorSchema, legacyCanvasWireSchema, legacyNodePlacementSchema,
  legacyPositionSchema, legacyProvenanceSchema, legacySizeSchema, semanticNodeSchema,
} from './legacy-shapes.ts';

const layoutTarget = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scope'), scopeId: z.string().min(1) }),
  z.object({ kind: z.literal('nodes'), nodeIds: z.array(z.string().min(1)) }),
]);
const layoutProposal = z.object({
  baseRevision: z.number().int().nonnegative(), layoutId: z.string().min(1),
  target: layoutTarget, affectedNodeIds: z.array(z.string().min(1)),
  placements: z.record(z.string(), legacyNodePlacementSchema),
});
const reference = z.object({ namespace: z.string().min(1), id: z.string().min(1) });
const sourceReference = reference.extend({ label: z.string().optional() });
const canvasCommand = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('diagram.create'),
    diagram: z.object({
      id: z.string().min(1), rootNodeId: z.string().min(1), status: z.enum(['active', 'archived']),
      subjectRef: reference.optional(), sourceRefs: z.array(sourceReference),
    }),
    root: semanticNodeSchema,
    placement: legacyNodePlacementSchema,
  }),
  z.object({ kind: z.literal('diagram.setStatus'), id: z.string().min(1), status: z.enum(['active', 'archived']) }),
  z.object({
    kind: z.literal('diagram.setReferences'), id: z.string().min(1),
    subjectRef: reference.optional(), sourceRefs: z.array(sourceReference),
  }),
  z.object({ kind: z.literal('node.add'), node: semanticNodeSchema, placement: legacyNodePlacementSchema }),
  z.object({ kind: z.literal('node.move'), id: z.string().min(1), position: legacyPositionSchema, layoutId: z.string().optional() }),
  z.object({ kind: z.literal('node.resize'), id: z.string().min(1), size: legacySizeSchema, layoutId: z.string().optional() }),
  z.object({ kind: z.literal('node.pin'), id: z.string().min(1), pinned: z.boolean(), layoutId: z.string().optional() }),
  z.object({
    kind: z.literal('node.update'), id: z.string().min(1),
    patch: z.object({
      label: z.string().optional(), description: z.string().optional(),
      kind: z.enum(LEGACY_KINDS).optional(),
    }),
  }),
  z.object({ kind: z.literal('node.setSubject'), id: z.string().min(1), subjectRef: reference.optional() }),
  z.object({ kind: z.literal('node.setDetailDiagram'), id: z.string().min(1), diagramId: z.string().min(1).optional() }),
  z.object({ kind: z.literal('node.reparent'), id: z.string().min(1), parentId: z.string().min(1) }),
  z.object({ kind: z.literal('node.setCollapsed'), id: z.string().min(1), collapsed: z.boolean(), layoutId: z.string().optional() }),
  z.object({ kind: z.literal('node.remove'), id: z.string().min(1) }),
  z.object({ kind: z.literal('wire.add'), wire: legacyCanvasWireSchema }),
  z.object({
    kind: z.literal('wire.update'), id: z.string().min(1),
    patch: z.object({
      label: z.string().optional(),
      kind: z.enum(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']).optional(),
    }),
  }),
  z.object({ kind: z.literal('wire.reconnect'), id: z.string().min(1), source: z.string().min(1), target: z.string().min(1) }),
  z.object({ kind: z.literal('wire.remove'), id: z.string().min(1) }),
  z.object({ kind: z.literal('layout.apply'), proposal: layoutProposal }),
  z.object({
    kind: z.literal('scope.layout'), id: z.string().min(1),
    layoutId: z.string().optional(), groupPadding: z.number().min(0).optional(),
  }),
]);
const changeSet = z.object({
  operationId: z.string().min(1), expectedRevision: z.number().int().nonnegative(),
  actor: legacyActorSchema, timestamp: z.string().min(1), provenance: legacyProvenanceSchema,
  commands: z.array(canvasCommand),
});

/** Runtime boundary for untrusted CLI and agent-authored operation batches. */
export const canvasChangeSetSchema = {
  parse(input: unknown): CanvasChangeSet { return changeSet.parse(input) as CanvasChangeSet; },
};
