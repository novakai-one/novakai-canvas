import type { Edge, Node } from '@xyflow/react';
import type { Layout, PlacedNode } from '../../interaction/reveal-tree';
import {
  atLeastWorking,
  type MissionZoomTier,
} from './mission-semantic-zoom';
import { missionHeroBounds, missionHeroProjection, type MissionStageProminence } from './mission-hero-geometry';

export interface MissionStageNodeData extends Record<string, unknown> {
  placed: PlacedNode;
  attention: boolean;
  tier: MissionZoomTier;
  prominence: MissionStageProminence;
  onReveal: () => void;
  onOpen: () => void;
}

export type MissionStageFlowNode = Node<MissionStageNodeData, 'sectional-stage'>;

export interface MissionStageEdgeData extends Record<string, unknown> {
  kind: 'sequence' | 'branch';
  depth: number;
  emphasized: boolean;
}

export type MissionStageFlowEdge = Edge<MissionStageEdgeData, 'sectional'>;

interface MissionGraphActions {
  selectedId: string | null;
  attentionId: string | null;
  tier: MissionZoomTier;
  reveal: (id: string) => void;
  open: (id: string) => void;
}

const edge = (
  source: PlacedNode,
  target: PlacedNode,
  kind: 'sequence' | 'branch',
  selectedId: string | null,
): MissionStageFlowEdge => ({
  id: `${kind}:${source.record.id}:${target.record.id}`,
  source: source.record.id,
  target: target.record.id,
  sourceHandle: kind === 'sequence' ? 'sequence-out' : 'branch-out',
  targetHandle: kind === 'sequence' ? 'sequence-in' : 'branch-in',
  type: 'sectional',
  selectable: false,
  focusable: false,
  deletable: false,
  data: {
    kind,
    depth: target.depth,
    emphasized: source.record.id === selectedId || target.record.id === selectedId,
  },
});

/** Adapts Mission projection geometry into React Flow without owning domain truth. */
export function missionGraphToFlow(layout: Layout, actions: MissionGraphActions) {
  const byId = new Map(layout.nodes.map((placed) => [placed.record.id, placed]));
  const roots = layout.nodes.filter((placed) => placed.depth === 0);

  const nodes: MissionStageFlowNode[] = layout.nodes.map((placed) => {
    const tier = placed.record.id === actions.selectedId ? atLeastWorking(actions.tier) : actions.tier;
    const selected = placed.record.id === actions.selectedId;
    const projection = missionHeroProjection(placed, layout, tier, selected);
    const bounds = missionHeroBounds(placed, layout, tier, selected);
    return {
      id: placed.record.id,
      type: 'sectional-stage',
      position: { x: projection.x, y: projection.y },
      origin: [0.5, 0.5],
      selected,
      draggable: true,
      selectable: true,
      deletable: false,
      ariaLabel: `Stage ${placed.sequenceLabel}: ${placed.record.title}`,
      style: { width: bounds.width, height: bounds.height },
      zIndex: placed.record.id === actions.selectedId ? 30 : Math.max(2, 12 - placed.depth),
      data: {
        placed,
        attention: placed.record.id === actions.attentionId,
        tier,
        prominence: projection.prominence,
        onReveal: () => actions.reveal(placed.record.id),
        onOpen: () => actions.open(placed.record.id),
      },
    };
  });

  const edges: MissionStageFlowEdge[] = roots.slice(0, -1).map((source, index) =>
    edge(source, roots[index + 1], 'sequence', actions.selectedId),
  );

  for (const child of layout.nodes) {
    if (!child.parentId) continue;
    const parent = byId.get(child.parentId);
    if (parent) edges.push(edge(parent, child, 'branch', actions.selectedId));
  }

  return { nodes, edges };
}
