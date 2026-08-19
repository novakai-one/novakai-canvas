import { NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import { NodePorts } from '../../presentation/nodes/node-ports.tsx';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';

type CalloutStackFlowNode = Node<ArchitectureNodeData, 'callout-stack'>;

/** Ordered highlights whose explicit item IDs feed the generic component-item selection path. */
export function CalloutStackNode({ data, selected }: NodeProps<CalloutStackFlowNode>) {
  const { node, selection, preferences, editable, select } = data;
  const callouts = node.callouts ?? [];
  const portsClass = preferences.nodes.showPorts === 'always' ? ' ports-always' : '';
  return (
    <div className={`callout-stack-node-shell${portsClass}`}>
      <article className="callout-stack-node">
        <NodeResizer
          isVisible={editable && selected}
          minHeight={100}
          minWidth={260}
          onResizeEnd={() => data.resizeEnd?.(node.id as string)}
        />
        <header className="node-header">
          <span className="node-label">{node.label}</span>
          {(!editable || preferences.nodes.showKinds) && <span className="node-kind">callout stack</span>}
        </header>
        <div className="callout-list">
          {callouts.map((callout) => {
            const isSelected = selection?.kind === 'component-item'
              && selection.nodeId === node.id
              && selection.collection === 'callouts'
              && selection.itemId === callout.id;
            return (
              <button
                className={`callout-row kind-${callout.kind}${isSelected ? ' is-selected' : ''}`}
                key={callout.id}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  select({
                    kind: 'component-item', nodeId: node.id,
                    collection: 'callouts', itemId: callout.id,
                  });
                }}
                type="button"
              >
                <span className="callout-kind">{callout.kind}</span>
                <span className="callout-text">{callout.text}</span>
              </button>
            );
          })}
        </div>
      </article>
      <NodePorts connectable={editable} />
    </div>
  );
}
