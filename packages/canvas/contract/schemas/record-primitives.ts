import { z } from 'zod';
import { nodeAppearanceSchema } from './node-appearance.ts';
import { wireAppearanceSchema } from './wire-appearance.ts';
import { containerArrangementSchema } from './presentation.ts';

export const positionSchema = z.object({ x: z.number(), y: z.number() });
export const sizeSchema = z.object({ width: z.number().positive(), height: z.number().positive() });
export const portSideSchema = z.enum(['top', 'right', 'bottom', 'left']);
export const canvasReferenceSchema = z.object({
  namespace: z.string().min(1), id: z.string().min(1),
});
export const sourceReferenceSchema = canvasReferenceSchema.extend({ label: z.string().optional() });

export const nodePlacementSchema = z.object({
  nodeId: z.string().min(1), position: positionSchema, size: sizeSchema,
  sizeMode: z.enum(['auto', 'manual']).optional(), pinned: z.boolean(),
});

export const wireRouteHintSchema = z.object({
  wireId: z.string().min(1),
  preferredSourceSide: portSideSchema.optional(),
  preferredTargetSide: portSideSchema.optional(),
  waypoints: z.array(positionSchema),
  labelPosition: z.number().min(0).max(1).optional(),
});

export const canvasLayoutSchema = z.object({
  id: z.string().min(1), name: z.string(), strategy: z.enum(['manual', 'hierarchy', 'flow']),
  placements: z.record(z.string(), nodePlacementSchema),
  wireRouteHints: z.record(z.string(), wireRouteHintSchema),
  appearanceByNodeId: z.record(z.string(), nodeAppearanceSchema).optional(),
  appearanceByWireId: z.record(z.string(), wireAppearanceSchema).optional(),
  arrangementByContainerId: z.record(z.string(), containerArrangementSchema).optional(),
});

export const interfaceObjectsSchema = z.record(z.string(), z.object({
  id: z.string().min(1), ownerId: z.string().min(1), name: z.string(),
  accepts: z.array(z.string()), returns: z.array(z.string()),
}));
export const typeObjectsSchema = z.record(z.string(), z.object({
  id: z.string().min(1), name: z.string(), fields: z.array(z.string()),
}));
export const actorSchema = z.object({
  id: z.string().min(1), kind: z.enum(['human', 'agent', 'system']),
});
export const provenanceSchema = z.object({
  source: z.enum(['ui', 'cli', 'agent', 'import', 'system']),
  sourceRef: z.string().optional(),
});
export const appliedOperationSchema = z.object({
  operationId: z.string().min(1), revision: z.number().int().nonnegative(), actor: actorSchema,
  timestamp: z.string().min(1), provenance: provenanceSchema, commandKinds: z.array(z.string()),
});
