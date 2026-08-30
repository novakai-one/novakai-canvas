import { type Node, type NodeProps } from '@xyflow/react';
import { NodePorts } from '../node-ports.tsx';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';
import { GLYPHS, iconGridColumns } from '@novakai/canvas';

type IconGridFlowNode = Node<ArchitectureNodeData, 'icon-grid'>;

/** A titled panel of icon-with-caption cells; the column rule is shared with the SVG host. */
export function IconGridNode({ data }: NodeProps<IconGridFlowNode>) {
  const { node, preferences, editable } = data;
  const items = node.iconItems ?? [];
  const portsClass = preferences.nodes.showPorts === 'always' ? ' ports-always' : '';
  return (
    <div className={`icon-grid-node-shell${portsClass}`}>
      <article className="icon-grid-node">
        <header className="node-header semantic-summary">
          <span className="node-label">{node.label}</span>
          {(!editable || preferences.nodes.showKinds) && <span className="node-kind">icon grid</span>}
        </header>
        <div
          className="icon-grid-cells semantic-essential"
          style={{ gridTemplateColumns: `repeat(${iconGridColumns(items.length)}, 1fr)` }}
        >
          {items.map((item, index) => (
            <span className="icon-grid-cell" key={`${index}-${item.icon}-${item.caption}`}>
              <svg aria-label={`${item.icon} icon`} role="img" viewBox="0 0 24 24">
                <path d={GLYPHS[item.icon]} />
              </svg>
              <span>{item.caption}</span>
            </span>
          ))}
        </div>
      </article>
      <NodePorts connectable={editable} methods={data.interfaces} node={data.node} />
    </div>
  );
}
