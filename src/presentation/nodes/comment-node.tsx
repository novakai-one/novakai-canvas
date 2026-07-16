import type { Node, NodeProps } from '@xyflow/react';
import type { ArchitectureNodeData } from '../projection';

type CommentFlowNode = Node<ArchitectureNodeData, 'comment'>;

export function CommentNode({ data }: NodeProps<CommentFlowNode>) {
  return <aside className="comment-node">{data.node.label}</aside>;
}
