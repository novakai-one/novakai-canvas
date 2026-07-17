import { NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import type { ArchitectureNodeData } from '../projection';

type ScopeFlowNode = Node<ArchitectureNodeData, 'scope'>;

/** Quiet project-scope container renderer; click the title to select, then resize. */
export function ScopeNode({ data, selected }: NodeProps<ScopeFlowNode>) {
  return (
    <section className="scope-node">
      <NodeResizer isVisible={selected} minHeight={160} minWidth={320} />
      <span
        onClick={(event) => { event.stopPropagation(); data.select({ kind: 'node', id: data.node.id }); }}
      >{data.node.label}</span>
    </section>
  );
}
