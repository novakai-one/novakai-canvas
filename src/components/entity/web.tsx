import { type CSSProperties } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { paletteCssVariables, resolveComponentPalette } from '@novakai/canvas';
import { NodeLabel } from '../node-label.tsx';
import { NodePorts } from '../node-ports.tsx';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';

type EntityFlowNode = Node<ArchitectureNodeData, 'entity'>;

/** Selectable fixed-column Entity backed by stable structured field identities. */
export function EntityNode({ data }: NodeProps<EntityFlowNode>) {
  const { node, selection, preferences, editable, select, appearance } = data;
  const colors = resolveComponentPalette(appearance.palette, appearance.theme, 'entity');
  const style = colors ? paletteCssVariables(colors) as CSSProperties : undefined;
  return <div className={`entity-shell${preferences.nodes.showPorts === 'always' ? ' ports-always' : ''}`}>
    <article className="entity-node" style={style}>
      <header className="entity-header semantic-summary">
        <NodeLabel editable={editable} label={node.label}
          rename={(next) => data.rename?.(node.id as string, next)} />
        <span>«entity»</span>
      </header>
      <div className="entity-columns semantic-essential" aria-hidden="true">
        <span>Type</span><span>Field</span><span>Keys</span>
      </div>
      <div className="entity-rows semantic-essential">
        {(node.entityFields ?? []).map((field) => {
          const selected = selection?.kind === 'component-item'
            && selection.nodeId === node.id && selection.collection === 'entityFields'
            && selection.itemId === field.id;
          return <button className={`entity-row${selected ? ' is-selected' : ''}`} key={field.id}
            onClick={(event) => {
              event.stopPropagation();
              select({
                kind: 'component-item', nodeId: node.id,
                collection: 'entityFields', itemId: field.id,
              });
            }} onPointerDown={(event) => event.stopPropagation()} type="button">
            <span>{field.valueType}</span>
            <span>{field.name}</span>
            <span>{field.keys.map((key) => key.toUpperCase()).join(' · ')}</span>
          </button>;
        })}
      </div>
    </article>
    <NodePorts connectable={editable} methods={data.interfaces} node={node} />
  </div>;
}
