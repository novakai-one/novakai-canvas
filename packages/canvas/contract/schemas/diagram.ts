import { z, type RefinementCtx } from 'zod';
import { ORIENTATIONS } from '../types/orientation.ts';
import type { NodeKind } from '../types/node-kind.ts';
import type { DiagramRecord } from '../records/index.ts';
import { nodeContentFields } from './content.ts';
import { wireCardinalitySchema } from './wire-cardinality.ts';
import {
  appliedOperationSchema, canvasLayoutSchema, canvasReferenceSchema,
  interfaceObjectsSchema, portSideSchema, sourceReferenceSchema, typeObjectsSchema,
} from './record-primitives.ts';

const endpoint = z.object({
  nodeId: z.string().min(1),
  anchor: z.object({ side: portSideSchema, ordinal: z.number().int().nonnegative() }).optional(),
  cardinality: wireCardinalitySchema.optional(),
});
const canvasNodeBase = {
  id: z.string().min(1), label: z.string(), description: z.string().optional(),
  parentId: z.string().min(1).optional(), band: z.number().int().nonnegative().optional(),
  lane: z.number().int().nonnegative().optional(), crossing: z.enum(['gated', 'free']).optional(),
  gate: z.string().min(1).optional(), interfaceIds: z.array(z.string().min(1)),
  typeIds: z.array(z.string().min(1)), subjectRef: canvasReferenceSchema.optional(),
  expandsToDiagramId: z.string().min(1).optional(),
};
const NODE_KINDS: [NodeKind, ...NodeKind[]] = [
  'group', 'module', 'object', 'runtime', 'resource', 'comment', 'tree', 'timeline',
  'metric', 'icon-card', 'icon-grid', 'callout-stack', 'block', 'ooux-object', 'entity',
];
const canvasNodeOptions = NODE_KINDS.map((kind) => z.object({
  ...canvasNodeBase, kind: z.literal(kind), ...nodeContentFields(kind),
}).strict());
const canvasNode = z.discriminatedUnion('kind', canvasNodeOptions as [
  (typeof canvasNodeOptions)[number], ...(typeof canvasNodeOptions)[number][],
]);
const canvasWire = z.object({
  id: z.string().min(1),
  kind: z.enum(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']),
  label: z.string(), source: endpoint, target: endpoint,
});
const flow = z.object({
  id: z.string().min(1), name: z.string().min(1),
  steps: z.array(z.object({
    ref: z.string().min(1), ordinal: z.number().int(), label: z.string().min(1).optional(),
  })),
});
const canvasView = z.object({
  id: z.string().min(1), name: z.string(), layoutId: z.string().min(1),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }),
  collapsedNodeIds: z.array(z.string().min(1)), hiddenKinds: z.array(z.enum(NODE_KINDS)),
  flowId: z.string().min(1).optional(),
});
const diagramRecord = z.object({
  schemaVersion: z.literal(3), id: z.string().min(1), name: z.string(),
  orientation: z.enum(ORIENTATIONS).optional(), status: z.enum(['active', 'archived']),
  revision: z.number().int().nonnegative(),
  nodes: z.record(z.string(), canvasNode), wires: z.record(z.string(), canvasWire),
  flows: z.record(z.string(), flow).optional(), interfaces: interfaceObjectsSchema,
  types: typeObjectsSchema, layouts: z.record(z.string(), canvasLayoutSchema),
  views: z.record(z.string(), canvasView), activeViewId: z.string().min(1),
  subjectRef: canvasReferenceSchema.optional(), sourceRefs: z.array(sourceReferenceSchema),
  appliedOperations: z.record(z.string(), appliedOperationSchema),
});

/** Builds the durable schema with core-owned cross-field validation attached. */
export function createDiagramRecordSchema(
  validate: (record: DiagramRecord, context: RefinementCtx) => void,
): { parse(input: unknown): DiagramRecord } {
  const refined = diagramRecord.superRefine((record, context) => validate(record as DiagramRecord, context));
  return { parse: (input) => refined.parse(input) as DiagramRecord };
}
