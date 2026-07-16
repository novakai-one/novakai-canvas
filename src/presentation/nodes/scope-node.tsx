import type { Node, NodeProps } from '@xyflow/react';
import type { ArchitectureNodeData } from '../projection';

type ScopeFlowNode = Node<ArchitectureNodeData, 'scope'>;

export function ScopeNode({ data }: NodeProps<ScopeFlowNode>) {
  return <section className="scope-node"><span>{data.node.label}</span></section>;
}
