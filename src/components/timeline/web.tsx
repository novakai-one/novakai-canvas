import { type Node, type NodeProps } from '@xyflow/react';
import { NodePorts } from '../node-ports.tsx';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';

type TimelineFlowNode = Node<ArchitectureNodeData, 'timeline'>;

/** Ordered steps as dots on a line; a forked turn carries the session it produced. */
export function TimelineNode({ data }: NodeProps<TimelineFlowNode>) {
  const { node, selection, preferences, editable, select } = data;
  const steps = node.steps ?? [];
  const portsClass = preferences.nodes.showPorts === 'always' ? ' ports-always' : '';
  return (
    <div className={`timeline-node-shell${portsClass}`}>
      <article className="tree-node timeline-node">
        <header className="node-header semantic-summary">
          <span className="node-label">{node.label}</span>
          <span className="node-kind">timeline</span>
        </header>
        <div className="tree-rows semantic-essential">
          {steps.map((step, index) => {
            const isSelected = selection?.kind === 'component-item'
              && selection.nodeId === node.id && selection.collection === 'steps' && selection.itemId === step.id;
            return (
              <button
                className={`tree-row tone-project timeline-step${isSelected ? ' is-selected' : ''}`}
                key={`${step.id}-${index}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  select({ kind: 'component-item', nodeId: node.id, collection: 'steps', itemId: step.id });
                }}
                type="button"
              >
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
              </button>
            );
          })}
        </div>
      </article>
      <NodePorts connectable={editable} methods={data.interfaces} node={data.node} />
    </div>
  );
}
