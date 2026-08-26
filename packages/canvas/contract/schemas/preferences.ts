import { z } from 'zod';
import { wireShapeSchema } from './wire-appearance.ts';

/** Wire-label sizes stay within the application's existing 12–18px type scale. */
export const WIRE_LABEL_SIZE_LIMITS = {
  base: 12, minimum: 12, maximum: 18, defaultMaximum: 13,
} as const;

/** Runtime validator for presentation preferences. */
export const canvasPreferencesSchema = z.object({
  schemaVersion: z.literal(1),
  appearance: z.object({
    density: z.enum(['compact', 'comfortable', 'roomy']).default('comfortable'),
    radius: z.number().min(0).max(16), theme: z.enum(['dark', 'light']).default('dark'),
    accent: z.enum(['gold', 'sage', 'slate']).default('gold'),
    textScale: z.number().min(0.85).max(1.35).optional(),
  }),
  canvas: z.object({
    showGrid: z.boolean(), snapToGrid: z.boolean(), gridSize: z.number().min(4).max(32),
    showControls: z.boolean(), groupPadding: z.number().min(16).max(160).default(40),
    targetSize: z.enum(['small', 'medium', 'large']).optional(),
  }),
  nodes: z.object({
    showKinds: z.boolean(), showDescriptions: z.boolean(),
    showInterfaces: z.enum(['always', 'selected', 'never']), showTypes: z.boolean(),
    showPorts: z.enum(['always', 'hover']),
  }),
  wires: z.object({
    showLabels: z.enum(['always', 'selected', 'never']), width: z.number().min(1).max(4),
    dimUnrelated: z.boolean(), shape: wireShapeSchema.optional(),
    labelScale: z.number().min(0.85).max(1.5).optional(),
    maxLabelSize: z.number().min(WIRE_LABEL_SIZE_LIMITS.minimum)
      .max(WIRE_LABEL_SIZE_LIMITS.maximum).optional(),
    avoidNodes: z.boolean().optional(),
  }),
  panel: z.object({
    width: z.number().min(280).max(560), defaultTab: z.enum(['inspect', 'preferences', 'json']),
    showEmptyFields: z.boolean(), railWidth: z.number().min(200).max(400).optional(),
    railCollapsed: z.boolean().optional(), studioCollapsed: z.boolean().optional(),
    reframeOnPanelMove: z.boolean().optional(), sections: z.enum(['accordion', 'all-open']).optional(),
    showDividers: z.boolean().optional(), leftDefaultTab: z.enum(['build', 'contents']).optional(),
  }),
  files: z.object({ autoSave: z.boolean(), saveDelay: z.number().min(100).max(5000) }),
});
