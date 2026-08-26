import { expect } from 'vitest';
import type { NodeId } from '@novakai/canvas';
import { defaultLayoutOptions } from '@novakai/canvas';
import type { LayoutGraph, LayoutPlan, LayoutSliceTarget } from '@novakai/canvas';
import { graphOfDiagram } from '@novakai/canvas';
import { layoutStrategyFor, planSliceLayout } from '@novakai/canvas';
import { diagramRecordSchema } from '@novakai/canvas';
import type { DiagramRecord, NodePlacement } from '@novakai/canvas';

/** The real migrated diagrams: layout is judged against the shapes Chris actually draws. */
export const records: Array<[string, DiagramRecord]> = Object.entries(
  import.meta.glob('../../../../../public/data/diagrams/*.json', {
    query: '?raw', import: 'default', eager: true,
  }) as Record<string, string>,
)
  .map(([path, raw]): [string, DiagramRecord] => [
    path.slice(path.lastIndexOf('/') + 1),
    diagramRecordSchema.parse(JSON.parse(raw)),
  ])
  .sort(([left], [right]) => left.localeCompare(right));

export function recordNamed(name: string): DiagramRecord {
  const found = records.find(([file]) => file === `${name}.json`);
  if (!found) throw new Error(`missing-fixture:${name}`);
  return found[1];
}

export function graphNamed(name: string): LayoutGraph {
  return graphOfDiagram(recordNamed(name));
}

export function planned(plan: LayoutPlan): Record<string, NodePlacement> {
  if (plan.status !== 'planned') throw new Error(`not-planned:${plan.status}:${plan.reason}`);
  return plan.placements;
}

export function containedIds(graph: LayoutGraph, containerId: string): string[] {
  const inside = Object.keys(graph.nodes).filter((id) => graph.nodes[id].parentId === containerId);
  for (let index = 0; index < inside.length; index += 1) {
    for (const id of Object.keys(graph.nodes)) {
      if (graph.nodes[id].parentId === inside[index]) inside.push(id);
    }
  }
  return inside;
}

export function withPinned(graph: LayoutGraph, nodeId: string): LayoutGraph {
  return {
    ...graph,
    placements: {
      ...graph.placements,
      [nodeId]: { ...graph.placements[nodeId], pinned: true },
    },
  };
}

/** Every placement the target does not name must come back byte-identical. */
export function expectUntouchedOutside(
  graph: LayoutGraph,
  after: Record<string, NodePlacement>,
  targetIds: string[],
): void {
  const inTarget = new Set(targetIds);
  let checked = 0;
  for (const [nodeId, before] of Object.entries(graph.placements)) {
    if (inTarget.has(nodeId)) continue;
    checked += 1;
    expect(JSON.stringify(after[nodeId])).toBe(JSON.stringify(before));
    expect(after[nodeId]).toBe(before);
  }
  expect(checked).toBeGreaterThan(0);
}


export { defaultLayoutOptions, graphOfDiagram, layoutStrategyFor, planSliceLayout };
export type { NodeId, LayoutGraph, LayoutSliceTarget };
