import { type Node, type NodeProps } from '@xyflow/react';
import { NodePorts } from '../../presentation/nodes/node-ports.tsx';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';
import { GLYPHS } from '../glyphs.ts';

type IconCardFlowNode = Node<ArchitectureNodeData, 'icon-card'>;

/** A semantic icon and short message rendered as one selectable card. */
export function IconCardNode({ data }: NodeProps<IconCardFlowNode>) {
  const { node, preferences, editable } = data;
  const icon = node.icon ?? 'check';
  const portsClass = preferences.nodes.showPorts === 'always' ? ' ports-always' : '';
  return (
    <div className={`icon-card-node-shell${portsClass}`}>
      <article className="icon-card-node">
        <header className="node-header">
          <span className="node-label">{node.label}</span>
          {(!editable || preferences.nodes.showKinds) && <span className="node-kind">icon card</span>}
        </header>
        <div className="icon-card-body">
          <span aria-label={`${icon} icon`} className="icon-card-glyph" role="img">
            <svg aria-hidden viewBox="0 0 24 24">
              <path d={GLYPHS[icon]} />
            </svg>
          </span>
          <p>{node.description}</p>
        </div>
      </article>
      <NodePorts connectable={editable} />
    </div>
  );
}
