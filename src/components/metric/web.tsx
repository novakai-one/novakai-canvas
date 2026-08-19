import { NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import { NodePorts } from '../../presentation/nodes/node-ports.tsx';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';

type MetricFlowNode = Node<ArchitectureNodeData, 'metric'>;

/** One prominent value, its context, and a restrained semantic status. */
export function MetricNode({ data, selected }: NodeProps<MetricFlowNode>) {
  const { node, preferences, editable } = data;
  const status = node.status ?? 'neutral';
  const portsClass = preferences.nodes.showPorts === 'always' ? ' ports-always' : '';
  return (
    <div className={`metric-node-shell${portsClass}`}>
      <article className={`metric-node status-${status}`}>
        <NodeResizer
          isVisible={editable && selected}
          minHeight={110}
          minWidth={200}
          onResizeEnd={() => data.resizeEnd?.(node.id as string)}
        />
        <header className="node-header">
          <span className="node-label">{node.label}</span>
          {(!editable || preferences.nodes.showKinds) && <span className="node-kind">metric</span>}
        </header>
        <div className="metric-content">
          <strong className="metric-value">{node.value}</strong>
          {node.detail && <span className="metric-detail">{node.detail}</span>}
          <span className="metric-status">{status}</span>
        </div>
      </article>
      <NodePorts connectable={editable} />
    </div>
  );
}
