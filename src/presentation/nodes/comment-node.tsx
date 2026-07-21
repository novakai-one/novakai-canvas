import { NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import type { ArchitectureNodeData } from '../projection';

type CommentFlowNode = Node<ArchitectureNodeData, 'comment'>;

/** Selectable freeform comment renderer; resizable while selected. */
export function CommentNode({ data, selected }: NodeProps<CommentFlowNode>) {
  return (
    <aside className="comment-node">
      <NodeResizer isVisible={data.editable && selected} minHeight={60} minWidth={160} />
      {data.node.label}
    </aside>
  );
}
