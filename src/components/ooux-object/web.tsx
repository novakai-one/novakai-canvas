import { type Node, type NodeProps } from '@xyflow/react';
import { NodeLabel } from '../../presentation/nodes/node-label.tsx';
import { NodePorts } from '../../presentation/nodes/node-ports.tsx';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';

type OouxObjectFlowNode = Node<ArchitectureNodeData, 'ooux-object'>;

/** Selectable OOUX object compartments backed by stable mixed row identities. */
export function OouxObjectNode({ data }: NodeProps<OouxObjectFlowNode>) {
  const { node, selection, preferences, editable, select } = data;
  return <div className={`ooux-object-shell${preferences.nodes.showPorts === 'always' ? ' ports-always' : ''}`}>
    <article className="ooux-object-node">
      <header className="ooux-object-header">
        <NodeLabel editable={editable} label={node.label}
          rename={(next) => data.rename?.(node.id as string, next)} />
        <span>«object»</span>
      </header>
      <div className="ooux-object-rows">
        {(node.oouxRows ?? []).map((row) => {
          const selected = selection?.kind === 'component-item'
            && selection.nodeId === node.id && selection.collection === 'oouxRows'
            && selection.itemId === row.id;
          return <button
            className={`ooux-row is-${row.kind}${row.kind === 'attribute' ? ` role-${row.role}` : ''}${selected ? ' is-selected' : ''}`}
            key={row.id}
            onClick={(event) => {
              event.stopPropagation();
              select({ kind: 'component-item', nodeId: node.id, collection: 'oouxRows', itemId: row.id });
            }}
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
          >
            <span className="ooux-row-value">
              {row.kind === 'cta' ? `ƒ  ${row.name}()` : `${row.name} : ${row.valueType}`}
            </span>
            <span className="ooux-row-meta">
              {row.kind === 'cta' ? `@${row.role}` : row.traits.join(' · ') || row.role}
            </span>
          </button>;
        })}
      </div>
    </article>
    <NodePorts connectable={editable} />
  </div>;
}
