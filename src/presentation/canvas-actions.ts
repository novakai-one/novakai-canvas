import type { ArchitectureDocument, CanvasNode, NodePlacement } from '../domain/model';

export type CreatableNodeKind = 'module' | 'object' | 'runtime' | 'resource' | 'comment' | 'group';

/** Semantic node and initial geometry produced for one add command. */
export interface CreatedCanvasNode {
  node: CanvasNode;
  placement: NodePlacement;
}

/** Builds a new child for the active map; ID generation remains at the UI edge. */
export function createCanvasNode(
  document: ArchitectureDocument,
  parentId: string,
  kind: CreatableNodeKind,
  id: string,
): CreatedCanvasNode {
  const count = Object.values(document.nodes).filter((node) => node.parentId === parentId).length;
  const semanticKind = kind === 'group' ? 'scope' : kind;
  const label = kind === 'comment' ? 'Add context here'
    : kind === 'group' ? 'New group'
      : `New ${kind}`;
  return {
    node: {
      id,
      kind: semanticKind,
      label,
      parentId,
      interfaceIds: [],
      typeIds: [],
    },
    placement: {
      nodeId: id,
      position: kind === 'comment'
        ? { x: 40 + (count % 3) * 300, y: 80 + (count % 4) * 140 }
        : { x: 60 + (count % 3) * 240, y: 120 + (count % 4) * 160 },
      size: kind === 'comment' ? { width: 240, height: 100 }
        : kind === 'group' ? { width: 480, height: 300 }
          : { width: 200, height: 110 },
      pinned: false,
    },
  };
}
