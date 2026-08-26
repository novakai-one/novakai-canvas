import { z } from 'zod';
import {
  SPACINGS, isAppearanceKey, nodeAppearanceSchema, type NodeAppearance, type Spacing,
} from './node-appearance.ts';
import { wireAppearanceSchema } from './wire-appearance.ts';

export * from './node-appearance.ts';

export const LAYOUT_MODES = ['stack', 'row', 'grid'] as const;
export const CONTAINER_ALIGNS = ['stretch', 'start', 'center', 'end'] as const;
export const GRID_COLUMNS = [1, 2, 3, 4, 5, 6] as const;

export type LayoutMode = (typeof LAYOUT_MODES)[number];
export type ContainerAlign = (typeof CONTAINER_ALIGNS)[number];
export type GridColumns = (typeof GRID_COLUMNS)[number];

/** Final container arrangement stored on one layout. */
export interface ContainerArrangement {
  layout: LayoutMode;
  childIds: string[];
  gap: Spacing;
  align: ContainerAlign;
  columns?: GridColumns;
}

/** Container values as authored, before compilation supplies direct-child identities. */
export type AuthoredArrangement = Omit<ContainerArrangement, 'childIds'>;

/** One parsed declaration's presentation, interpreted against its owning component metadata. */
export type ParsedPresentation = {
  appearance?: NodeAppearance;
  arrangement?: AuthoredArrangement;
};

export type ArrangementKey = 'layout' | 'columns' | 'gap' | 'align';

/** Reserved so pre-activation container attributes fail instead of becoming descriptions. */
export function isPresentationAttributeKey(value: string): boolean {
  return isAppearanceKey(value) || ['layout', 'columns', 'gap'].includes(value);
}

export function isArrangementKey(value: string): value is ArrangementKey {
  return ['layout', 'columns', 'gap', 'align'].includes(value);
}

const spacing = z.union(SPACINGS.map((value) => z.literal(value)) as [
  z.ZodLiteral<Spacing>, ...z.ZodLiteral<Spacing>[],
]);
const columns = z.union(GRID_COLUMNS.map((value) => z.literal(value)) as [
  z.ZodLiteral<GridColumns>, ...z.ZodLiteral<GridColumns>[],
]);

/** Strict runtime boundary for stored arrangements. */
export const containerArrangementSchema = z.object({
  layout: z.enum(LAYOUT_MODES),
  childIds: z.array(z.string().min(1)),
  gap: spacing,
  align: z.enum(CONTAINER_ALIGNS),
  columns: columns.optional(),
}).strict().superRefine((arrangement, context) => {
  if (arrangement.layout === 'grid' && arrangement.columns === undefined) {
    context.addIssue({ code: 'custom', message: 'grid arrangement requires columns', path: ['columns'] });
  }
  if (arrangement.layout !== 'grid' && arrangement.columns !== undefined) {
    context.addIssue({ code: 'custom', message: 'columns is only valid for grid arrangement', path: ['columns'] });
  }
  if (new Set(arrangement.childIds).size !== arrangement.childIds.length) {
    context.addIssue({ code: 'custom', message: 'arrangement childIds must be unique', path: ['childIds'] });
  }
});

/** Strict runtime boundary for every presentation value stored on a layout. */
export const layoutPresentationSchema = z.object({
  appearanceByNodeId: z.record(z.string(), nodeAppearanceSchema),
  appearanceByWireId: z.record(z.string(), wireAppearanceSchema),
  arrangementByContainerId: z.record(z.string(), containerArrangementSchema),
}).strict();
