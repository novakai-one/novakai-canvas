/** The one place any direction is decided. */

import type { PortSide } from '../../contract/records/layout.ts';
import type { Orientation } from '../../contract/types/orientation.ts';
import type { DiagramRecord } from '../../contract/records/index.ts';

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
