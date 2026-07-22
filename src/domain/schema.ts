import { z } from 'zod';

const position = z.object({ x: z.number(), y: z.number() });
const size = z.object({ width: z.number().positive(), height: z.number().positive() });

/** Runtime validator for architecture documents. */
export const architectureDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  revision: z.number().int().nonnegative(),
  nodes: z.record(z.string(), z.object({
    id: z.string().min(1),
    kind: z.enum(['scope', 'module', 'object', 'runtime', 'resource', 'comment', 'tree']),
    label: z.string(),
    description: z.string().optional(),
    position,
    size,
    parentId: z.string().optional(),
    interfaceIds: z.array(z.string()),
    typeIds: z.array(z.string()),
    rows: z.array(z.object({
      id: z.string().min(1),
      kind: z.enum(['project', 'mission', 'task', 'bucket']),
      status: z.string().optional(),
      parentRowId: z.string().optional(),
      badges: z.array(z.string()),
      label: z.string().optional(),
    })).optional(),
  })),
  interfaces: z.record(z.string(), z.object({
    id: z.string().min(1), ownerId: z.string().min(1), name: z.string(),
    accepts: z.array(z.string()), returns: z.array(z.string()),
  })),
  types: z.record(z.string(), z.object({
    id: z.string().min(1), name: z.string(), fields: z.array(z.string()),
  })),
  wires: z.record(z.string(), z.object({
    id: z.string().min(1), source: z.string().min(1), target: z.string().min(1), label: z.string(),
    kind: z.enum(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']),
    routing: z.literal('elbow'),
  })),
});

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
