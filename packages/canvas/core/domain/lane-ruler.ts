/** One across-axis ruler per diagram: the column edges every band shares. */

import type { Axis } from './axis.ts';
import type { Size } from '../../contract/types/spatial.ts';
import type { Topology } from './topology.ts';

/** Across-axis gap between lanes; matches the grid column gap of automatic containers. */
export const LANE_GAP = 40;

/** The single set of across-axis edge coordinates every band in one diagram uses. */
export interface LaneRuler {
  /** Declared lane ordinals, ascending; dense-packed by position. */
  readonly lanes: readonly number[];
  /** Across-start per dense lane slot; the final entry is the ruler's total extent. */
  readonly edges: readonly number[];
  /** Across-axis start of one declared lane; identical no matter which band asks. */
  offsetFor(lane: number): number;
  /** Across-axis content extent of one declared lane (excludes the trailing gap). */
  extentFor(lane: number): number;
}

/**
 * Computes the ruler from the widest node declaring each lane, so a lane occupies
 * identical across-axis coordinates in every band. Deterministic: identical input
 * returns an identical ruler.
 */
export function laneRuler(
  topology: Topology,
  sizes: Readonly<Record<string, Size>>,
  axis: Axis,
): LaneRuler {
  const lanes = [...new Set(topology.lanes.values())].sort((left, right) => left - right);
  const edges: number[] = [0];
  for (const lane of lanes) {
    let widest = 0;
    for (const [nodeId, declared] of topology.lanes) {
      if (declared !== lane) continue;
      const size = sizes[nodeId as string];
      if (!size) continue;
      widest = Math.max(widest, axis.across === 'x' ? size.width : size.height);
    }
    edges.push(edges[edges.length - 1] + widest + LANE_GAP);
  }
  const indexOf = (lane: number): number => {
    const index = lanes.indexOf(lane);
    if (index < 0) throw new RangeError(`laneRuler: unknown lane ${lane}`);
    return index;
  };
  return {
    lanes,
    edges,
    offsetFor: (lane) => edges[indexOf(lane)],
    extentFor: (lane) => edges[indexOf(lane) + 1] - edges[indexOf(lane)] - LANE_GAP,
  };
}
