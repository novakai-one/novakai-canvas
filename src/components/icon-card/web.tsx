import { NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import { NodePorts } from '../../presentation/nodes/node-ports.tsx';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';
import { ICON_CARD_PATHS } from './component.ts';

type IconCardFlowNode = Node<ArchitectureNodeData, 'icon-card'>;

/** A semantic icon and short message rendered as one selectable card. */
export function IconCardNode({ data, selected }: NodeProps<IconCardFlowNode>) {
  const { node, preferences, editable } = data;
  const icon = node.icon ?? 'check';
  const portsClass = preferences.nodes.showPorts === 'always' ? ' ports-always' : '';
  return (
    <div className={`icon-card-node-shell${portsClass}`}>
      <article className="icon-card-node">
        <NodeResizer
          isVisible={editable && selected}
          minHeight={104}
          minWidth={240}
          onResizeEnd={() => data.resizeEnd?.(node.id as string)}
        />
        <header className="node-header">
          <span className="node-label">{node.label}</span>
          {(!editable || preferences.nodes.showKinds) && <span className="node-kind">icon card</span>}
        </header>
        <div className="icon-card-body">
          <span aria-label={`${icon} icon`} className="icon-card-glyph" role="img">
            <svg aria-hidden viewBox="0 0 24 24">
              <path d={ICON_CARD_PATHS[icon]} />
            </svg>
          </span>
          <p>{node.description}</p>
        </div>
      </article>
      <NodePorts connectable={editable} />
    </div>
  );
}
