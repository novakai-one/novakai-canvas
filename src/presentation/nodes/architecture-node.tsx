import { Handle, NodeResizer, Position, type NodeProps, type Node } from '@xyflow/react';
import { NODE_PORTS } from '../../domain/flow';
import type { ArchitectureNodeData } from '../projection';

type ArchitectureFlowNode = Node<ArchitectureNodeData, 'architecture'>;

const PORT_POSITION = {
  top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right,
} as const;

/**
 * Every side of a node offers one port, and that port both gives and takes a wire.
 *
 * One source at the bottom and one target at the top meant a wire could only ever run
 * downward, and dropping an end on any other side was a silent no-op. One handle per side —
 * rather than an overlapping source/target pair, which strict mode refuses to join because
 * the drop lands on whichever of the two sits on top — is what makes "drag this end to that
 * side and have it stick" true. The canvas runs `ConnectionMode.Loose` so a single handle
 * serves as either end; the ids are the stable side names, so a stored `preferredSide`
 * addresses them directly.
 */
function NodePorts({ connectable }: { connectable: boolean }) {
  return (
    <>
      {NODE_PORTS.map((side) => (
        <Handle
          id={side}
          isConnectable={connectable}
          key={side}
          position={PORT_POSITION[side]}
          type="source"
        />
      ))}
    </>
  );
}

/** Selectable architecture node with interface and type children. */
export function ArchitectureNode({ data, selected }: NodeProps<ArchitectureFlowNode>) {
  const { node, interfaces, types, preferences, selection, editable, select } = data;
  const showInterfaces = !editable || preferences.nodes.showInterfaces === 'always'
    || (preferences.nodes.showInterfaces === 'selected' && selected);
  const portsClass = preferences.nodes.showPorts === 'always' ? 'ports-always' : '';

  return (
    <article className={`architecture-node kind-${node.kind} ${portsClass}`}>
      <NodeResizer isVisible={editable && selected} minHeight={80} minWidth={160} />
      <NodePorts connectable={editable} />
      <header className="node-header">
        <span className="node-label">{node.label}</span>
        {(!editable || preferences.nodes.showKinds) && <span className="node-kind">{node.kind}</span>}
      </header>
      {(!editable || preferences.nodes.showDescriptions) && node.description && (
        <p className="node-description">{node.description}</p>
      )}
      {showInterfaces && interfaces.length > 0 && (
        <div className="interface-list">
          {interfaces.map((item) => (
            <button
              className={selection?.kind === 'interface' && selection.id === item.id ? 'is-selected' : ''}
              key={item.id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); select({ kind: 'interface', id: item.id }); }}
              type="button"
            >
              <span className="iface-name">{item.name}({item.accepts.join(', ')})</span>
              <span>→ {item.returns.length ? item.returns.join(', ') : 'void'}</span>
            </button>
          ))}
        </div>
      )}
      {(!editable || preferences.nodes.showTypes) && types.length > 0 && (
        <div className="type-list">
          {types.map((item) => (
            <button
              className={selection?.kind === 'type' && selection.id === item.id ? 'is-selected' : ''}
              key={item.id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); select({ kind: 'type', id: item.id }); }}
              type="button"
            >{editable ? item.name : `${item.name} { ${item.fields.join(', ')} }`}</button>
          ))}
        </div>
      )}
    </article>
  );
}
