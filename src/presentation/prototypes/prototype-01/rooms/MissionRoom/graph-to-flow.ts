import type { Edge, Node } from '@xyflow/react';
import { NODE_HEIGHT, NODE_WIDTH, type Layout, type PlacedNode } from '../../interaction/reveal-tree';

export interface MissionStageNodeData extends Record<string, unknown> {
  placed: PlacedNode;
  attention: boolean;
  onSelect: () => void;
  onReveal: () => void;
  onOpen: () => void;
}

export type MissionStageFlowNode = Node<MissionStageNodeData, 'stage'>;

interface MissionGraphActions {
  selectedId: string | null;
  attentionId: string | null;
  select: (id: string) => void;
  reveal: (id: string) => void;
  open: (id: string) => void;
}

const sequenceEdge = (source: PlacedNode, target: PlacedNode): Edge => ({
  id: `sequence:${source.record.id}:${target.record.id}`,
  source: source.record.id,
  target: target.record.id,
  sourceHandle: 'sequence-out',
  targetHandle: 'sequence-in',
  type: 'smoothstep',
  className: 'mission-flow__edge mission-flow__edge--sequence',
  selectable: false,
  focusable: false,
  deletable: false,
});

const branchEdge = (parent: PlacedNode, child: PlacedNode): Edge => ({
  id: `branch:${parent.record.id}:${child.record.id}`,
  source: parent.record.id,
  target: child.record.id,
  sourceHandle: 'branch-out',
  targetHandle: 'branch-in',
  type: 'smoothstep',
  className: 'mission-flow__edge mission-flow__edge--branch',
  selectable: false,
  focusable: false,
  deletable: false,
});

/** Adapts the existing Mission World layout into React Flow without owning that layout. */
export function missionGraphToFlow(layout: Layout, actions: MissionGraphActions) {
  const byId = new Map(layout.nodes.map((placed) => [placed.record.id, placed]));
  const rootNodes = layout.nodes.filter((placed) => placed.depth === 0);

  const nodes: MissionStageFlowNode[] = layout.nodes.map((placed) => ({
    id: placed.record.id,
    type: 'stage',
    position: { x: placed.x, y: placed.y },
    selected: placed.record.id === actions.selectedId,
    draggable: true,
    selectable: true,
    deletable: false,
    style: { width: NODE_WIDTH, height: NODE_HEIGHT },
    data: {
      placed,
      attention: placed.record.id === actions.attentionId,
      onSelect: () => actions.select(placed.record.id),
      onReveal: () => actions.reveal(placed.record.id),
      onOpen: () => actions.open(placed.record.id),
    },
  }));

  const edges = rootNodes.slice(0, -1).map((source, index) =>
    sequenceEdge(source, rootNodes[index + 1]),
  );

  for (const child of layout.nodes) {
    if (!child.parentId) continue;
    const parent = byId.get(child.parentId);
    if (parent) edges.push(branchEdge(parent, child));
  }

  return { nodes, edges };
}
