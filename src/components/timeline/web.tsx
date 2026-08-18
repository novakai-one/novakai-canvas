import { NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import { NodePorts } from '../../presentation/nodes/node-ports';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';

type TimelineFlowNode = Node<ArchitectureNodeData, 'timeline'>;

/** Ordered steps as dots on a line; a forked turn carries the session it produced. */
export function TimelineNode({ data, selected }: NodeProps<TimelineFlowNode>) {
  const { node, editable } = data;
  const steps = node.steps ?? [];
  return (
    <article className="tree-node timeline-node">
      <NodeResizer isVisible={editable && selected} minHeight={80} minWidth={220} onResizeEnd={() => data.resizeEnd?.(node.id as string)} />
      <NodePorts connectable={editable} />
      <header className="node-header">
        <span className="node-label">{node.label}</span>
        <span className="node-kind">timeline</span>
      </header>
      <div className="tree-rows">
        {steps.map((step, index) => (
          <div className="tree-row tone-project timeline-step" key={`${step.id}-${index}`}>
            <span
              aria-hidden
              style={{
                background: '#0F6E56',
                borderRadius: '50%',
                display: 'inline-block',
                flex: '0 0 auto',
                height: 8,
                marginRight: 10,
                width: 8,
                ...(index < steps.length - 1
                  ? { boxShadow: '0 14px 0 -3.2px #0F6E56' }
                  : {}),
              }}
            />
            <span className="tree-row-text">{step.label}</span>
            {step.fork && <span className="tree-row-badge">↳ {step.fork}</span>}
          </div>
        ))}
      </div>
    </article>
  );
}
