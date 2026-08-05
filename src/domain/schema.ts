import { z } from 'zod';
import type { ArchitectureDocument } from './model';

const position = z.object({ x: z.number(), y: z.number() });
const size = z.object({ width: z.number().positive(), height: z.number().positive() });

const treeRows = z.array(z.object({
  id: z.string().min(1),
  kind: z.enum(['project', 'mission', 'task', 'bucket']),
  status: z.string().optional(),
  parentRowId: z.string().optional(),
  badges: z.array(z.string()),
  label: z.string().optional(),
})).optional();

const semanticNode = z.object({
    id: z.string().min(1),
    kind: z.enum(['scope', 'module', 'object', 'runtime', 'resource', 'comment', 'tree']),
    label: z.string(),
    description: z.string().optional(),
    parentId: z.string().optional(),
    interfaceIds: z.array(z.string()),
    typeIds: z.array(z.string()),
    rows: treeRows,
});

const interfaceObjects = z.record(z.string(), z.object({
  id: z.string().min(1), ownerId: z.string().min(1), name: z.string(),
  accepts: z.array(z.string()), returns: z.array(z.string()),
}));

const typeObjects = z.record(z.string(), z.object({
  id: z.string().min(1), name: z.string(), fields: z.array(z.string()),
}));

const wires = z.record(z.string(), z.object({
  id: z.string().min(1), source: z.string().min(1), target: z.string().min(1), label: z.string(),
  kind: z.enum(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']),
  routing: z.literal('elbow'),
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
    placements: z.record(z.string(), z.object({
      nodeId: z.string().min(1),
      position,
      size,
      pinned: z.boolean(),
    })),
    wireRouteHints: z.record(z.string(), z.object({
      wireId: z.string().min(1),
      preferredSourceSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
      preferredTargetSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
      waypoints: z.array(position),
    })),
  })),
}).superRefine((document, context) => {
  if (!document.layouts[document.activeLayoutId]) {
    context.addIssue({
      code: 'custom',
      message: `active layout "${document.activeLayoutId}" does not exist`,
      path: ['activeLayoutId'],
    });
  }
});

const legacyArchitectureDocument = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  revision: z.number().int().nonnegative(),
  nodes: z.record(z.string(), semanticNode.extend({ position, size })),
  interfaces: interfaceObjects,
  types: typeObjects,
  wires,
});

const DEFAULT_LAYOUT_ID = 'layout-default';

/** Parses current documents and losslessly migrates legacy node geometry into a layout. */
export function parseArchitectureDocument(input: unknown): ArchitectureDocument {
  const version = z.object({ schemaVersion: z.number() }).passthrough().parse(input).schemaVersion;
  if (version === 2) return architectureDocumentV2.parse(input) as ArchitectureDocument;
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
      },
    },
  }) as ArchitectureDocument;
}

/** Runtime validator and migration seam for architecture documents. */
export const architectureDocumentSchema = {
  parse: parseArchitectureDocument,
};

/** Runtime validator for presentation preferences. */
export const canvasPreferencesSchema = z.object({
  schemaVersion: z.literal(1),
  appearance: z.object({
    density: z.enum(['compact', 'comfortable']),
    radius: z.number().min(0).max(16),
    // Defaults keep preference files written before theming valid.
    theme: z.enum(['dark', 'light']).default('dark'),
    accent: z.enum(['gold', 'sage', 'slate']).default('gold'),
  }),
  canvas: z.object({
    showGrid: z.boolean(), snapToGrid: z.boolean(), gridSize: z.number().min(4).max(32), showControls: z.boolean(),
    showLegend: z.boolean().default(true),
  }),
  nodes: z.object({
    showKinds: z.boolean(), showDescriptions: z.boolean(),
    showInterfaces: z.enum(['always', 'selected', 'never']), showTypes: z.boolean(),
    showPorts: z.enum(['always', 'hover']),
  }),
  wires: z.object({
    showLabels: z.enum(['always', 'selected', 'never']), width: z.number().min(1).max(4), dimUnrelated: z.boolean(),
  }),
  panel: z.object({
    width: z.number().min(300).max(560), defaultTab: z.enum(['inspect', 'preferences', 'json']),
    showEmptyFields: z.boolean(),
  }),
  files: z.object({ autoSave: z.boolean(), saveDelay: z.number().min(100).max(5000) }),
});
