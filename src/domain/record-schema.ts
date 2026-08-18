import { z } from 'zod';
import { kindList } from '../components/registry.ts';
import type { DiagramRecord, LibraryIndex } from './records.ts';

const position = z.object({ x: z.number(), y: z.number() });
const size = z.object({ width: z.number().positive(), height: z.number().positive() });
const portSide = z.enum(['top', 'right', 'bottom', 'left']);

const endpoint = z.object({
  nodeId: z.string().min(1),
  anchor: z.object({ side: portSide, ordinal: z.number().int().nonnegative() }).optional(),
});

const treeRows = z.array(z.object({
  id: z.string().min(1),
  kind: z.enum(['project', 'mission', 'task', 'bucket']),
  status: z.string().optional(),
  parentRowId: z.string().optional(),
  badges: z.array(z.string()),
  label: z.string().optional(),
})).optional();

const canvasReference = z.object({ namespace: z.string().min(1), id: z.string().min(1) });
const sourceReference = canvasReference.extend({ label: z.string().optional() });

const canvasNode = z.object({
  id: z.string().min(1),
  kind: z.enum(kindList()),
  label: z.string(),
  description: z.string().optional(),
  parentId: z.string().min(1).optional(),
  interfaceIds: z.array(z.string().min(1)),
  typeIds: z.array(z.string().min(1)),
  rows: treeRows,
  subjectRef: canvasReference.optional(),
  expandsToDiagramId: z.string().min(1).optional(),
});

const canvasWire = z.object({
  id: z.string().min(1),
  kind: z.enum(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']),
  label: z.string(),
  source: endpoint,
  target: endpoint,
});

const nodePlacement = z.object({
  nodeId: z.string().min(1), position, size, pinned: z.boolean(),
});

const wireRouteHint = z.object({
  wireId: z.string().min(1),
  preferredSourceSide: portSide.optional(),
  preferredTargetSide: portSide.optional(),
  waypoints: z.array(position),
  labelPosition: z.number().min(0).max(1).optional(),
});

const canvasLayout = z.object({
  id: z.string().min(1),
  name: z.string(),
  strategy: z.enum(['manual', 'hierarchy', 'flow']),
  placements: z.record(z.string(), nodePlacement),
  wireRouteHints: z.record(z.string(), wireRouteHint),
});

const canvasView = z.object({
  id: z.string().min(1),
  name: z.string(),
  layoutId: z.string().min(1),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }),
  collapsedNodeIds: z.array(z.string().min(1)),
  hiddenKinds: z.array(z.enum(kindList())),
});

const interfaceObjects = z.record(z.string(), z.object({
  id: z.string().min(1), ownerId: z.string().min(1), name: z.string(),
  accepts: z.array(z.string()), returns: z.array(z.string()),
}));

const typeObjects = z.record(z.string(), z.object({
  id: z.string().min(1), name: z.string(), fields: z.array(z.string()),
}));

const actor = z.object({
  id: z.string().min(1),
  kind: z.enum(['human', 'agent', 'system']),
});

const provenance = z.object({
  source: z.enum(['ui', 'cli', 'agent', 'import', 'system']),
  sourceRef: z.string().optional(),
});

const appliedOperation = z.object({
  operationId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  actor,
  timestamp: z.string().min(1),
  provenance,
  commandKinds: z.array(z.string()),
});

const diagramRecord = z.object({
  schemaVersion: z.literal(3),
  id: z.string().min(1),
  name: z.string(),
  status: z.enum(['active', 'archived']),
  revision: z.number().int().nonnegative(),
  nodes: z.record(z.string(), canvasNode),
  wires: z.record(z.string(), canvasWire),
  interfaces: interfaceObjects,
  types: typeObjects,
  layouts: z.record(z.string(), canvasLayout),
  views: z.record(z.string(), canvasView),
  activeViewId: z.string().min(1),
  subjectRef: canvasReference.optional(),
  sourceRefs: z.array(sourceReference),
  appliedOperations: z.record(z.string(), appliedOperation),
}).superRefine((record, context) => {
  if (!record.views[record.activeViewId]) {
    context.addIssue({
      code: 'custom',
      message: `active view "${record.activeViewId}" does not exist`,
      path: ['activeViewId'],
    });
  }
});

/** Runtime validator for one independently stored diagram record. */
export const diagramRecordSchema = {
  parse(input: unknown): DiagramRecord {
    return diagramRecord.parse(input) as DiagramRecord;
  },
};

const crossDiagramLink = z.object({
  id: z.string().min(1),
  kind: z.enum(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']),
  label: z.string(),
  source: z.object({ diagramId: z.string().min(1), nodeId: z.string().min(1) }),
  target: z.object({ diagramId: z.string().min(1), nodeId: z.string().min(1) }),
});

const libraryEntry = z.object({
  id: z.string().min(1),
  name: z.string(),
  status: z.enum(['active', 'archived']),
  revision: z.number().int().nonnegative(),
  nodeLabels: z.array(z.string()),
});

const libraryIndex = z.object({
  schemaVersion: z.literal(3),
  revision: z.number().int().nonnegative(),
  entries: z.record(z.string(), libraryEntry),
  links: z.record(z.string(), crossDiagramLink),
  migratedOperations: z.record(z.string(), appliedOperation),
});

/** Runtime validator for the searchable index over every diagram record. */
export const libraryIndexSchema = {
  parse(input: unknown): LibraryIndex {
    return libraryIndex.parse(input) as LibraryIndex;
  },
};
