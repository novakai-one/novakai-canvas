import { z } from 'zod';
import type { CanvasPreferences, ThemePresetId } from '../records/preferences.ts';
import { THEME_COLOR_ROLES, THEME_PRESET_IDS } from '../records/preferences.ts';
import { wireShapeSchema } from './wire-appearance.ts';

/** Wire-label sizes stay within the application's existing 12–18px type scale. */
export const WIRE_LABEL_SIZE_LIMITS = {
  base: 12, minimum: 12, maximum: 18, defaultMaximum: 13,
} as const;

const canvasSchema = z.object({
  showGrid: z.boolean(), snapToGrid: z.boolean(), gridSize: z.number().min(4).max(32),
  showControls: z.boolean(), groupPadding: z.number().min(16).max(160).default(40),
  targetSize: z.enum(['small', 'medium', 'large']).optional(),
});

const nodesSchema = z.object({
  showKinds: z.boolean(), showDescriptions: z.boolean(),
  showInterfaces: z.enum(['always', 'selected', 'never']), showTypes: z.boolean(),
  showPorts: z.enum(['always', 'hover']),
});

const wiresSchema = z.object({
  showLabels: z.enum(['always', 'selected', 'never']), width: z.number().min(1).max(4),
  dimUnrelated: z.boolean(), shape: wireShapeSchema.optional(),
  labelScale: z.number().min(0.85).max(1.5).optional(),
  maxLabelSize: z.number().min(WIRE_LABEL_SIZE_LIMITS.minimum)
    .max(WIRE_LABEL_SIZE_LIMITS.maximum).optional(),
  avoidNodes: z.boolean().optional(),
});

const panelSchema = z.object({
  width: z.number().min(280).max(560), defaultTab: z.enum(['inspect', 'preferences', 'json']),
  showEmptyFields: z.boolean(), railWidth: z.number().min(200).max(400).optional(),
  railCollapsed: z.boolean().optional(), studioCollapsed: z.boolean().optional(),
  reframeOnPanelMove: z.boolean().optional(), sections: z.enum(['accordion', 'all-open']).optional(),
  showDividers: z.boolean().optional(), leftDefaultTab: z.enum(['build', 'contents']).optional(),
});

const filesSchema = z.object({ autoSave: z.boolean(), saveDelay: z.number().min(100).max(5000) });

const legacyPreferencesSchema = z.object({
  schemaVersion: z.literal(1),
  appearance: z.object({
    density: z.enum(['compact', 'comfortable', 'roomy']).default('comfortable'),
    radius: z.number().min(0).max(16), theme: z.enum(['dark', 'light']).default('dark'),
    accent: z.enum(['gold', 'sage', 'slate']).default('gold'),
    textScale: z.number().min(0.85).max(1.35).optional(),
  }),
  canvas: canvasSchema,
  nodes: nodesSchema,
  wires: wiresSchema,
  panel: panelSchema,
  files: filesSchema,
});

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).transform((value) => value.toUpperCase());
const themeOverridesSchema = z.object(Object.fromEntries(
  THEME_COLOR_ROLES.map((role) => [role, hexColorSchema.optional()]),
) as Record<(typeof THEME_COLOR_ROLES)[number], z.ZodOptional<typeof hexColorSchema>>).partial();
const overridesByPresetSchema = z.object(Object.fromEntries(
  THEME_PRESET_IDS.map((preset) => [preset, themeOverridesSchema.optional()]),
) as Record<ThemePresetId, z.ZodOptional<typeof themeOverridesSchema>>).partial();

const currentPreferencesSchema = z.object({
  schemaVersion: z.literal(2),
  appearance: z.object({
    density: z.enum(['compact', 'comfortable', 'roomy']).default('comfortable'),
    radius: z.number().min(0).max(16),
    preset: z.enum(THEME_PRESET_IDS).default('carbon'),
    overridesByPreset: overridesByPresetSchema.default({}),
    textScale: z.number().min(0.85).max(1.35).optional(),
  }),
  canvas: canvasSchema,
  nodes: nodesSchema,
  wires: wiresSchema,
  panel: panelSchema,
  files: filesSchema,
});

const LEGACY_PRESET: Record<string, ThemePresetId> = {
  'dark:gold': 'carbon', 'dark:sage': 'plum', 'dark:slate': 'midnight',
  'light:gold': 'porcelain', 'light:sage': 'frost', 'light:slate': 'blueprint',
};

/** Runtime validator and lossless structural migration for presentation preferences. */
export const canvasPreferencesSchema = z.union([
  currentPreferencesSchema,
  legacyPreferencesSchema.transform((legacy): CanvasPreferences => ({
    ...legacy,
    schemaVersion: 2,
    appearance: {
      density: legacy.appearance.density,
      radius: legacy.appearance.radius,
      preset: LEGACY_PRESET[`${legacy.appearance.theme}:${legacy.appearance.accent}`] ?? 'carbon',
      overridesByPreset: {},
      ...(legacy.appearance.textScale === undefined ? {} : { textScale: legacy.appearance.textScale }),
    },
  })),
]).transform((value): CanvasPreferences => value as CanvasPreferences);
