/** Row kinds a tree node can carry. */
type TreeRowKind = 'project' | 'mission' | 'task' | 'bucket';

/** One semantic row inside a tree node — identity only; looks derive in presentation. */
export interface TreeRow {
  id: string;
  kind: TreeRowKind;
  status?: string;
  parentRowId?: string;
  badges: string[];
  /** Display override for aggregate rows (e.g. "(no mission) 15 tasks"). */
  label?: string;
}

/** One semantic turn inside a timeline node. */
export interface TimelineStep {
  id: string;
  label: string;
  fork?: string;
}

/** Semantic metric state; renderers decide its colour and typography. */
export type MetricStatus = 'neutral' | 'success' | 'warning' | 'critical';

/** Fixed icon vocabulary carried as meaning, never as artwork. */
export const ICON_NAMES = ['check', 'clock', 'people', 'shield', 'target', 'trend'] as const;
export type IconName = (typeof ICON_NAMES)[number];
export type IconCardIcon = IconName;

/** Semantic emphasis of one callout; presentation derives from this value. */
export type CalloutKind = 'info' | 'warning' | 'decision' | 'success';

/** One stable, selectable highlight in a callout stack. */
export interface CalloutItem { id: string; kind: CalloutKind; text: string }

export type { EntityField, EntityKey } from '../schemas/entity.ts';
export type {
  OouxAttributeRole, OouxAttributeRow, OouxAttributeTrait, OouxCtaRow, OouxRow,
} from '../schemas/ooux-object.ts';
