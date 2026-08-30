import { type Node, type NodeProps } from '@xyflow/react';
import type { ArchitectureNodeData } from '../../presentation/projection';

type CommentFlowNode = Node<ArchitectureNodeData, 'comment'>;

/** Selectable freeform comment renderer; resizable while selected. */
export function CommentNode({ data }: NodeProps<CommentFlowNode>) {
  return (
    <aside className="comment-node">
      {data.node.label}
    </aside>
  );
}
