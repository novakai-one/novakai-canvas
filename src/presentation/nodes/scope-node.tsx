import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react';
import { ARCHITECTURE_FLOW } from '../../domain/flow';
import type { ArchitectureNodeData } from '../projection';

type ScopeFlowNode = Node<ArchitectureNodeData, 'scope'>;

/** Quiet project-scope container renderer; click the title to select, then resize. */
export function ScopeNode({ data, selected }: NodeProps<ScopeFlowNode>) {
  const portPosition = { top: Position.Top, bottom: Position.Bottom } as const;
  const standalone = data.node.label.startsWith('Standalone');
  return (
    <section className={`scope-node${standalone ? ' scope-node--standalone' : ''}`}>
      <NodeResizer isVisible={data.editable && selected} minHeight={160} minWidth={320} />
      <Handle isConnectable={data.editable} type="target" position={portPosition[ARCHITECTURE_FLOW.targetPort]} />
      <span
        onClick={(event) => { event.stopPropagation(); data.select({ kind: 'node', id: data.node.id }); }}
      >{data.node.label}</span>
      <Handle isConnectable={data.editable} type="source" position={portPosition[ARCHITECTURE_FLOW.sourcePort]} />
    </section>
  );
}
