/** The one place any direction is decided. */

import type { PortSide } from './layout-record.ts';
import type { DiagramRecord } from './records.ts';

export const ORIENTATIONS = ['top-down', 'left-right'] as const;
export type Orientation = typeof ORIENTATIONS[number];

/** Every direction one diagram needs, resolved from its orientation. */
export interface Axis {
  rankDirection: 'TB' | 'LR';
  sourcePort: PortSide;
  targetPort: PortSide;
  /** The coordinate depth increases along. */
  along: 'x' | 'y';
  /** The coordinate lanes are ordered across. */
  across: 'x' | 'y';
}

const AXES: Record<Orientation, Axis> = {
  'top-down': {
    rankDirection: 'TB', sourcePort: 'bottom', targetPort: 'top', along: 'y', across: 'x',
  },
  'left-right': {
    rankDirection: 'LR', sourcePort: 'right', targetPort: 'left', along: 'x', across: 'y',
  },
};

/** Total over both permitted orientations. Pure; reads no record and no module constant. */
export function resolveAxis(orientation: Orientation): Axis {
  return AXES[orientation];
}

/** The axis at right angles to this one: the pairs a router falls back to. */
export function crossAxis(axis: Axis): Axis {
  return axis.along === 'y' ? AXES['left-right'] : AXES['top-down'];
}

/** A record's declared orientation, or the top-down default when absent. */
export function orientationOf(record: Pick<DiagramRecord, 'orientation'>): Orientation {
  return record.orientation ?? 'top-down';
}

export function isOrientation(value: string): value is Orientation {
  return (ORIENTATIONS as readonly string[]).includes(value);
}

/**
 * The sides a node offers a wire, in the order they are rendered.
 *
 * Unrelated to `Axis`: this is what a *hand* may use, not what the router prefers.
 */
export const NODE_PORTS = ['top', 'right', 'bottom', 'left'] as const;

export type NodePort = typeof NODE_PORTS[number];
