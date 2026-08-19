import { z } from 'zod';
import { allComponents, contentFieldsFor, kindList } from '../components/registry.ts';
import type { ArchitectureDocument, CanvasChangeSet } from './model.ts';
import { WIRE_LABEL_SIZE_LIMITS } from './wire-label-size.ts';

/** Legacy document kind vocabulary: `scope` where the current record model uses `group`. */
const legacyKindList = () => ['scope', ...kindList().filter((k) => k !== 'group')] as [string, ...string[]];

const position = z.object({ x: z.number(), y: z.number() });
const size = z.object({ width: z.number().positive(), height: z.number().positive() });
const nodePlacement = z.object({
  nodeId: z.string().min(1), position, size, pinned: z.boolean(),
});

const semanticNodeBase = {
  id: z.string().min(1),
  label: z.string(),
  description: z.string().optional(),
  parentId: z.string().optional(),
  interfaceIds: z.array(z.string()),
  typeIds: z.array(z.string()),
  subjectRef: z.object({ namespace: z.string().min(1), id: z.string().min(1) }).optional(),
  expandsToDiagramId: z.string().min(1).optional(),
};

function semanticNodeSchema<ExtraFields extends Record<string, z.ZodTypeAny>>(extraFields: ExtraFields) {
  const options = allComponents().map((component) => z.object({
    ...semanticNodeBase,
    kind: z.literal(component.kind === 'group' ? 'scope' : component.kind),
    ...contentFieldsFor(component.kind),
    ...extraFields,
  }).strict());
  return z.discriminatedUnion('kind', options as [
    (typeof options)[number],
    ...(typeof options)[number][],
  ]);
}

const semanticNode = semanticNodeSchema({});
const legacySemanticNode = semanticNodeSchema({ position, size });

const interfaceObjects = z.record(z.string(), z.object({
  id: z.string().min(1), ownerId: z.string().min(1), name: z.string(),
  accepts: z.array(z.string()), returns: z.array(z.string()),
}));

const typeObjects = z.record(z.string(), z.object({
  id: z.string().min(1), name: z.string(), fields: z.array(z.string()),
}));

const canvasWire = z.object({
  id: z.string().min(1), source: z.string().min(1), target: z.string().min(1), label: z.string(),
  kind: z.enum(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']),
  routing: z.literal('elbow'),
});
const wires = z.record(z.string(), canvasWire);

const actor = z.object({
  id: z.string().min(1),
  kind: z.enum(['human', 'agent', 'system']),
});

const provenance = z.object({
  source: z.enum(['ui', 'cli', 'agent', 'import', 'system']),
  sourceRef: z.string().optional(),
});

const appliedOperations = z.record(z.string(), z.object({
  operationId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  actor,
  timestamp: z.string().min(1),
  provenance,
  commandKinds: z.array(z.enum([
    'document.import',
    'diagram.create', 'diagram.rename', 'diagram.setStatus', 'diagram.setReferences',
    'node.add', 'node.move', 'node.resize', 'node.pin', 'node.update', 'node.remove',
    'node.setSubject', 'node.setDetailDiagram', 'node.reparent', 'node.setCollapsed',
    'wire.add', 'wire.update', 'wire.reconnect', 'wire.remove', 'layout.apply', 'scope.layout',
  ])),
}));

const architectureDocumentV2 = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1),
  name: z.string().min(1),
  revision: z.number().int().nonnegative(),
  nodes: z.record(z.string(), semanticNode),
  interfaces: interfaceObjects,
  types: typeObjects,
  wires,
  activeLayoutId: z.string().min(1),
  layouts: z.record(z.string(), z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    strategy: z.enum(['manual', 'hierarchy']),
    placements: z.record(z.string(), nodePlacement),
    wireRouteHints: z.record(z.string(), z.object({
      wireId: z.string().min(1),
      preferredSourceSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
      preferredTargetSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
      waypoints: z.array(position),
    })),
    collapsedNodeIds: z.array(z.string().min(1)).default([]),
  })),
  diagrams: z.record(z.string(), z.object({
    id: z.string().min(1),
    rootNodeId: z.string().min(1),
    status: z.enum(['active', 'archived']),
    subjectRef: z.object({ namespace: z.string().min(1), id: z.string().min(1) }).optional(),
    sourceRefs: z.array(z.object({
      namespace: z.string().min(1), id: z.string().min(1), label: z.string().optional(),
    })),
  })).default({}),
  appliedOperations: appliedOperations.default({}),
}).superRefine((document, context) => {
  if (!document.layouts[document.activeLayoutId]) {
    context.addIssue({
      code: 'custom',
      message: `active layout "${document.activeLayoutId}" does not exist`,
      path: ['activeLayoutId'],
    });
  }
  for (const [diagramId, diagram] of Object.entries(document.diagrams)) {
    const root = document.nodes[diagram.rootNodeId];
    if (!root || root.kind !== 'scope' || root.parentId) {
      context.addIssue({
        code: 'custom',
        message: `diagram "${diagramId}" must reference a top-level scope root`,
        path: ['diagrams', diagramId, 'rootNodeId'],
      });
    }
  }
});

const legacyArchitectureDocument = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  revision: z.number().int().nonnegative(),
  nodes: z.record(z.string(), legacySemanticNode),
  interfaces: interfaceObjects,
  types: typeObjects,
  wires,
});

const DEFAULT_LAYOUT_ID = 'layout-default';

/** Parses current documents and losslessly migrates legacy node geometry into a layout. */
export function parseArchitectureDocument(input: unknown): ArchitectureDocument {
  const version = z.object({ schemaVersion: z.number() }).passthrough().parse(input).schemaVersion;
  if (version === 2) {
    const parsed = architectureDocumentV2.parse(input);
    const diagrams = Object.keys(parsed.diagrams).length > 0 ? parsed.diagrams
      : Object.fromEntries(Object.values(parsed.nodes)
        .filter((node) => node.kind === 'scope' && !node.parentId)
        .map((node) => [node.id, {
          id: node.id, rootNodeId: node.id, status: 'active' as const, sourceRefs: [],
        }]));
    return { ...parsed, diagrams } as ArchitectureDocument;
  }
  const legacy = legacyArchitectureDocument.parse(input);
  return architectureDocumentV2.parse({
    schemaVersion: 2,
    id: legacy.id,
    name: legacy.name,
    revision: legacy.revision,
    nodes: Object.fromEntries(Object.entries(legacy.nodes).map(([id, node]) => {
      const { position: _position, size: _size, ...meaning } = node;
      return [id, meaning];
    })),
    interfaces: legacy.interfaces,
    types: legacy.types,
    wires: legacy.wires,
    activeLayoutId: DEFAULT_LAYOUT_ID,
    layouts: {
      [DEFAULT_LAYOUT_ID]: {
        id: DEFAULT_LAYOUT_ID,
        name: 'Default',
        strategy: 'manual',
        placements: Object.fromEntries(Object.entries(legacy.nodes).map(([id, node]) => [id, {
          nodeId: id,
          position: node.position,
          size: node.size,
          pinned: false,
        }])),
        wireRouteHints: {},
        collapsedNodeIds: [],
      },
    },
    diagrams: Object.fromEntries(Object.values(legacy.nodes)
      .filter((node) => node.kind === 'scope' && !node.parentId)
      .map((node) => [node.id, {
        id: node.id, rootNodeId: node.id, status: 'active', sourceRefs: [],
      }])),
    appliedOperations: {},
  }) as ArchitectureDocument;
}

/** Runtime validator and migration seam for architecture documents. */
export const architectureDocumentSchema = {
  parse: parseArchitectureDocument,
};

const layoutTarget = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scope'), scopeId: z.string().min(1) }),
  z.object({ kind: z.literal('nodes'), nodeIds: z.array(z.string().min(1)) }),
]);

const layoutProposal = z.object({
  baseRevision: z.number().int().nonnegative(),
  layoutId: z.string().min(1),
  target: layoutTarget,
  affectedNodeIds: z.array(z.string().min(1)),
  placements: z.record(z.string(), nodePlacement),
});

const canvasCommand = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('diagram.create'),
    diagram: z.object({
      id: z.string().min(1), rootNodeId: z.string().min(1), status: z.enum(['active', 'archived']),
      subjectRef: z.object({ namespace: z.string().min(1), id: z.string().min(1) }).optional(),
      sourceRefs: z.array(z.object({ namespace: z.string().min(1), id: z.string().min(1), label: z.string().optional() })),
    }),
    root: semanticNode,
    placement: nodePlacement,
  }),
  z.object({ kind: z.literal('diagram.setStatus'), id: z.string().min(1), status: z.enum(['active', 'archived']) }),
  z.object({
    kind: z.literal('diagram.setReferences'), id: z.string().min(1),
    subjectRef: z.object({ namespace: z.string().min(1), id: z.string().min(1) }).optional(),
    sourceRefs: z.array(z.object({ namespace: z.string().min(1), id: z.string().min(1), label: z.string().optional() })),
  }),
  z.object({ kind: z.literal('node.add'), node: semanticNode, placement: nodePlacement }),
  z.object({ kind: z.literal('node.move'), id: z.string().min(1), position, layoutId: z.string().optional() }),
  z.object({ kind: z.literal('node.resize'), id: z.string().min(1), size, layoutId: z.string().optional() }),
  z.object({ kind: z.literal('node.pin'), id: z.string().min(1), pinned: z.boolean(), layoutId: z.string().optional() }),
  z.object({
    kind: z.literal('node.update'), id: z.string().min(1),
    patch: z.object({
      label: z.string().optional(), description: z.string().optional(),
      kind: z.enum(legacyKindList()).optional(),
    }),
  }),
  z.object({
    kind: z.literal('node.setSubject'), id: z.string().min(1),
    subjectRef: z.object({ namespace: z.string().min(1), id: z.string().min(1) }).optional(),
  }),
  z.object({ kind: z.literal('node.setDetailDiagram'), id: z.string().min(1), diagramId: z.string().min(1).optional() }),
  z.object({ kind: z.literal('node.reparent'), id: z.string().min(1), parentId: z.string().min(1) }),
  z.object({ kind: z.literal('node.setCollapsed'), id: z.string().min(1), collapsed: z.boolean(), layoutId: z.string().optional() }),
  z.object({ kind: z.literal('node.remove'), id: z.string().min(1) }),
  z.object({ kind: z.literal('wire.add'), wire: canvasWire }),
  z.object({
    kind: z.literal('wire.update'), id: z.string().min(1),
    patch: z.object({
      label: z.string().optional(),
      kind: z.enum(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']).optional(),
    }),
  }),
  z.object({
    kind: z.literal('wire.reconnect'), id: z.string().min(1),
    source: z.string().min(1), target: z.string().min(1),
  }),
  z.object({ kind: z.literal('wire.remove'), id: z.string().min(1) }),
  z.object({ kind: z.literal('layout.apply'), proposal: layoutProposal }),
  z.object({
    kind: z.literal('scope.layout'), id: z.string().min(1),
    layoutId: z.string().optional(), groupPadding: z.number().min(0).optional(),
  }),
]);

const changeSet = z.object({
  operationId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
  actor,
  timestamp: z.string().min(1),
  provenance,
  commands: z.array(canvasCommand),
});

/** Runtime boundary for untrusted CLI and agent-authored operation batches. */
export const canvasChangeSetSchema = {
  parse(input: unknown): CanvasChangeSet {
    return changeSet.parse(input) as CanvasChangeSet;
  },
};

/** Runtime validator for presentation preferences. */
export const canvasPreferencesSchema = z.object({
  schemaVersion: z.literal(1),
  appearance: z.object({
    density: z.enum(['compact', 'comfortable', 'roomy']).default('comfortable'),
    radius: z.number().min(0).max(16),
    // Defaults keep preference files written before theming valid.
    theme: z.enum(['dark', 'light']).default('dark'),
    accent: z.enum(['gold', 'sage', 'slate']).default('gold'),
    textScale: z.number().min(0.85).max(1.35).optional(),
  }),
  canvas: z.object({
    showGrid: z.boolean(), snapToGrid: z.boolean(), gridSize: z.number().min(4).max(32), showControls: z.boolean(),
    showLegend: z.boolean().default(true),
    groupPadding: z.number().min(16).max(160).default(40),
    targetSize: z.enum(['small', 'medium', 'large']).optional(),
  }),
  nodes: z.object({
    showKinds: z.boolean(), showDescriptions: z.boolean(),
    showInterfaces: z.enum(['always', 'selected', 'never']), showTypes: z.boolean(),
    showPorts: z.enum(['always', 'hover']),
  }),
  wires: z.object({
    showLabels: z.enum(['always', 'selected', 'never']), width: z.number().min(1).max(4), dimUnrelated: z.boolean(),
    // All optional: a preferences file written before these existed opens at the old behaviour.
    shape: z.enum(['elbow', 'straight', 'curved', 'stepped']).optional(),
    labelScale: z.number().min(0.85).max(1.5).optional(),
    maxLabelSize: z.number()
      .min(WIRE_LABEL_SIZE_LIMITS.minimum)
      .max(WIRE_LABEL_SIZE_LIMITS.maximum)
      .optional(),
    avoidNodes: z.boolean().optional(),
  }),
  panel: z.object({
    width: z.number().min(280).max(560), defaultTab: z.enum(['inspect', 'preferences', 'json']),
    showEmptyFields: z.boolean(),
    // Added with the rail. Optional, so a file written before it existed still validates.
    railWidth: z.number().min(200).max(400).optional(),
    railCollapsed: z.boolean().optional(),
    studioCollapsed: z.boolean().optional(),
    // Optional and absent means off: a file written before this setting existed must not start
    // re-framing the camera on its owner.
    reframeOnPanelMove: z.boolean().optional(),
    sections: z.enum(['accordion', 'all-open']).optional(),
    showDividers: z.boolean().optional(),
    leftDefaultTab: z.enum(['build', 'contents']).optional(),
  }),
  files: z.object({ autoSave: z.boolean(), saveDelay: z.number().min(100).max(5000) }),
});
