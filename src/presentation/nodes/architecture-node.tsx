import { Handle, NodeResizer, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ArchitectureNodeData } from '../projection';

type ArchitectureFlowNode = Node<ArchitectureNodeData, 'architecture'>;

/** Selectable architecture node with interface and type children. */
export function ArchitectureNode({ data, selected }: NodeProps<ArchitectureFlowNode>) {
  const { node, interfaces, types, preferences, selection, select } = data;
  const showInterfaces = preferences.nodes.showInterfaces === 'always'
    || (preferences.nodes.showInterfaces === 'selected' && selected);
  const portsClass = preferences.nodes.showPorts === 'always' ? 'ports-always' : '';

  return (
    <article className={`architecture-node kind-${node.kind} ${portsClass}`}>
      <NodeResizer isVisible={selected} minHeight={80} minWidth={160} />
      <Handle type="target" position={Position.Left} />
      <header className="node-header">
        <span className="node-label">{node.label}</span>
        {preferences.nodes.showKinds && <span className="node-kind">{node.kind}</span>}
      </header>
      {preferences.nodes.showDescriptions && node.description && (
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
      {preferences.nodes.showTypes && types.length > 0 && (
        <div className="type-list">
          {types.map((item) => (
            <button
              className={selection?.kind === 'type' && selection.id === item.id ? 'is-selected' : ''}
              key={item.id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); select({ kind: 'type', id: item.id }); }}
              type="button"
            >{item.name}</button>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </article>
  );
}
