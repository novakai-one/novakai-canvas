import { z } from 'zod';
import { ORIENTATIONS } from '../types/orientation.ts';
import { nodeContentFields } from './content.ts';
import { containerArrangementSchema, nodeAppearanceSchema } from './presentation.ts';
import { wireAppearanceSchema } from './wire-appearance.ts';

const V3_KINDS = [
  'group', 'module', 'object', 'runtime', 'resource', 'comment', 'tree', 'timeline',
  'metric', 'icon-card', 'callout-stack', 'block', 'ooux-object', 'entity',
] as const;
export const LEGACY_KINDS = [
  'scope', ...V3_KINDS.filter((kind) => kind !== 'group'),
] as [string, ...string[]];

export const legacyPositionSchema = z.object({ x: z.number(), y: z.number() });
export const legacySizeSchema = z.object({ width: z.number().positive(), height: z.number().positive() });
export const legacyNodePlacementSchema = z.object({
  nodeId: z.string().min(1), position: legacyPositionSchema, size: legacySizeSchema,
  sizeMode: z.enum(['auto', 'manual']).optional(), pinned: z.boolean(),
});
const semanticNodeBase = {
  id: z.string().min(1), label: z.string(), description: z.string().optional(),
  parentId: z.string().optional(), interfaceIds: z.array(z.string()), typeIds: z.array(z.string()),
  subjectRef: z.object({ namespace: z.string().min(1), id: z.string().min(1) }).optional(),
  expandsToDiagramId: z.string().min(1).optional(),
};

export function legacySemanticNodeSchema<ExtraFields extends Record<string, z.ZodTypeAny>>(
  extraFields: ExtraFields,
) {
  const options = V3_KINDS.map((kind) => z.object({
    ...semanticNodeBase,
    kind: z.literal(kind === 'group' ? 'scope' : kind),
    ...nodeContentFields(kind),
    ...extraFields,
  }).strict());
  return z.discriminatedUnion('kind', options as [
    (typeof options)[number], ...(typeof options)[number][],
  ]);
}

export const semanticNodeSchema = legacySemanticNodeSchema({});
const legacySemanticNode = legacySemanticNodeSchema({
  position: legacyPositionSchema, size: legacySizeSchema,
});
const interfaceObjects = z.record(z.string(), z.object({
  id: z.string().min(1), ownerId: z.string().min(1), name: z.string(),
  accepts: z.array(z.string()), returns: z.array(z.string()),
}));
const typeObjects = z.record(z.string(), z.object({
  id: z.string().min(1), name: z.string(), fields: z.array(z.string()),
}));
export const legacyCanvasWireSchema = z.object({
  id: z.string().min(1), source: z.string().min(1), target: z.string().min(1), label: z.string(),
  kind: z.enum(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']),
  routing: z.literal('elbow'),
});
const wires = z.record(z.string(), legacyCanvasWireSchema);
export const legacyActorSchema = z.object({
  id: z.string().min(1), kind: z.enum(['human', 'agent', 'system']),
});
export const legacyProvenanceSchema = z.object({
  source: z.enum(['ui', 'cli', 'agent', 'import', 'system']), sourceRef: z.string().optional(),
});
const appliedOperations = z.record(z.string(), z.object({
  operationId: z.string().min(1), revision: z.number().int().nonnegative(),
  actor: legacyActorSchema, timestamp: z.string().min(1), provenance: legacyProvenanceSchema,
  commandKinds: z.array(z.enum([
    'document.import',
    'diagram.create', 'diagram.rename', 'diagram.setOrientation', 'diagram.setStatus', 'diagram.setReferences',
    'node.add', 'node.move', 'node.resize', 'node.pin', 'node.update', 'node.remove',
    'node.setSubject', 'node.setDetailDiagram', 'node.reparent', 'node.setCollapsed',
    'wire.add', 'wire.update', 'wire.reconnect', 'wire.remove', 'layout.apply', 'scope.layout',
  ])),
}));

export const architectureDocumentV2Schema = z.object({
  schemaVersion: z.literal(2), id: z.string().min(1), name: z.string().min(1),
  orientation: z.enum(ORIENTATIONS).optional(), revision: z.number().int().nonnegative(),
  nodes: z.record(z.string(), semanticNodeSchema), interfaces: interfaceObjects,
  types: typeObjects, wires, activeLayoutId: z.string().min(1),
  layouts: z.record(z.string(), z.object({
    id: z.string().min(1), name: z.string().min(1), strategy: z.enum(['manual', 'hierarchy']),
    placements: z.record(z.string(), legacyNodePlacementSchema),
    wireRouteHints: z.record(z.string(), z.object({
      wireId: z.string().min(1),
      preferredSourceSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
      preferredTargetSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
      waypoints: z.array(legacyPositionSchema),
    })),
    collapsedNodeIds: z.array(z.string().min(1)).default([]),
    appearanceByNodeId: z.record(z.string(), nodeAppearanceSchema).default({}),
    appearanceByWireId: z.record(z.string(), wireAppearanceSchema).default({}),
    arrangementByContainerId: z.record(z.string(), containerArrangementSchema).default({}),
  })),
  diagrams: z.record(z.string(), z.object({
    id: z.string().min(1), rootNodeId: z.string().min(1), status: z.enum(['active', 'archived']),
    subjectRef: z.object({ namespace: z.string().min(1), id: z.string().min(1) }).optional(),
    sourceRefs: z.array(z.object({
      namespace: z.string().min(1), id: z.string().min(1), label: z.string().optional(),
    })),
  })).default({}),
  appliedOperations: appliedOperations.default({}),
}).superRefine((document, context) => {
  if (!document.layouts[document.activeLayoutId]) {
    context.addIssue({
      code: 'custom', message: `active layout "${document.activeLayoutId}" does not exist`,
      path: ['activeLayoutId'],
    });
  }
  for (const [diagramId, diagram] of Object.entries(document.diagrams)) {
    const root = document.nodes[diagram.rootNodeId];
    if (!root || root.kind !== 'scope' || root.parentId) {
      context.addIssue({
        code: 'custom', message: `diagram "${diagramId}" must reference a top-level scope root`,
        path: ['diagrams', diagramId, 'rootNodeId'],
      });
    }
  }
});

export const legacyArchitectureDocumentSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().min(1), name: z.string().min(1),
  revision: z.number().int().nonnegative(), nodes: z.record(z.string(), legacySemanticNode),
  interfaces: interfaceObjects, types: typeObjects, wires,
});
