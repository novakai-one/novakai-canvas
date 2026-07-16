import type { Node, NodeProps } from '@xyflow/react';
import type { ArchitectureNodeData } from '../projection';

type CommentFlowNode = Node<ArchitectureNodeData, 'comment'>;

/** Selectable freeform comment renderer. */
export function CommentNode({ data }: NodeProps<CommentFlowNode>) {
  return <aside className="comment-node">{data.node.label}</aside>;
}
