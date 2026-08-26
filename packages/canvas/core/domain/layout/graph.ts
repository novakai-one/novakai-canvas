/** Reading a layout graph: what is inside what, and where it currently sits. */

import type { LayoutId } from '../../../contract/brands.ts';
import type { DiagramRecord } from '../../../contract/records/index.ts';
import type { LayoutGraph } from './contract.ts';

/** Reads one saved layout of a record as a layout graph, defaulting to the active view's. */
export function graphOfDiagram(record: DiagramRecord, layoutId?: LayoutId): LayoutGraph {
  const resolvedId = layoutId ?? record.views[record.activeViewId]?.layoutId;
  const layout = resolvedId === undefined ? undefined : record.layouts[resolvedId];
  if (!layout) throw new Error(`unknown-layout:${resolvedId ?? ''}`);
  return { nodes: record.nodes, wires: record.wires, placements: layout.placements };
}
