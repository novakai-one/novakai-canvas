import { asId } from '../domain/id-cast';
import type { NodeId } from '../domain/ids';
import type { CanvasNode, DiagramRecord } from '../domain/records';

/** Node kinds the toolbar can create. Trees are authored by the CLI, so they are not offered. */
export type CreatableNodeKind = 'module' | 'object' | 'runtime' | 'resource' | 'comment' | 'group';

/** Semantic node and initial geometry produced for one `node.add` command. */
export interface CreatedCanvasNode {
  node: CanvasNode;
  placement: { position: { x: number; y: number }; size: { width: number; height: number } };
}

/**
 * Builds a new child of one group, ready for one `node.add` command.
 *
 * ID generation stays at the UI edge — the capability accepts an identity, it never invents one —
 * and the offset walk keeps successive additions from stacking on top of each other.
 */
export function createCanvasNode(
  record: DiagramRecord,
  parentId: NodeId | undefined,
  kind: CreatableNodeKind,
  id: string,
): CreatedCanvasNode {
  const count = Object.values(record.nodes).filter((node) => node.parentId === parentId).length;
  const label = kind === 'comment' ? 'Add context here'
    : kind === 'group' ? 'New group'
      : `New ${kind}`;
  return {
    node: {
      id: asId<NodeId>(id),
      kind,
      label,
      parentId,
      interfaceIds: [],
      typeIds: [],
    },
    placement: {
      position: kind === 'comment'
        ? { x: 40 + (count % 3) * 300, y: 80 + (count % 4) * 140 }
        : { x: 60 + (count % 3) * 240, y: 120 + (count % 4) * 160 },
      size: kind === 'comment' ? { width: 240, height: 100 }
        : kind === 'group' ? { width: 480, height: 300 }
          : { width: 200, height: 110 },
    },
  };
}

/**
 * The container a new object belongs to: the diagram's own root group.
 *
 * A record's root is the one group with no parent. A diagram with nothing drawn yet has none, and
 * the new object is then added at the top level rather than refused.
 */
export function rootGroupId(record: DiagramRecord): NodeId | undefined {
  return Object.values(record.nodes)
    .find((node) => node.kind === 'group' && !node.parentId)?.id;
}
