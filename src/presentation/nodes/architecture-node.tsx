import { type CSSProperties } from 'react';
import { type NodeProps, type Node } from '@xyflow/react';
import { paletteCssVariables, resolveComponentPalette } from '../../components/component-palette';
import { NodePorts } from './node-ports';
import { NodeLabel } from './node-label';
import type { ArchitectureNodeData } from '../projection';

type ArchitectureFlowNode = Node<ArchitectureNodeData, 'architecture'>;

/** Selectable architecture node with interface and type children. */
export function ArchitectureNode({ data, selected }: NodeProps<ArchitectureFlowNode>) {
  const { node, interfaces, types, preferences, selection, editable, select, appearance } = data;
  const showInterfaces = !editable || preferences.nodes.showInterfaces === 'always'
    || (preferences.nodes.showInterfaces === 'selected' && selected);
  const portsClass = preferences.nodes.showPorts === 'always' ? 'ports-always' : '';
  const palette = resolveComponentPalette(appearance.palette, appearance.theme, 'standard');
  const style = palette ? paletteCssVariables(palette) as CSSProperties : undefined;

  return (
    /*
      * Ports are siblings of the body, not children of it.
      *
      * The body clips its content for its rounded corners, which ate the outer half of every
      * port and forced them inward — leaving the right and bottom dots a full diameter further
      * in than the top and left, and, worse, moving the anchor React Flow derives from them so
      * every wire began *inside* the node and had to climb out. Out here, under React Flow's own
      * unclipped node wrapper, a port sits centred on the edge again: symmetric, and the wire
      * starts exactly where the box ends.
      */
    <>
      <article className={`architecture-node kind-${node.kind} ${portsClass}`} style={style}>
        <header className="node-header semantic-summary">
        <NodeLabel
          editable={editable}
          label={node.label}
          rename={(next) => data.rename?.(node.id as string, next)}
        />
        {appearance.showKindBadge && <span className="node-kind">{node.kind}</span>}
      </header>
      {(!editable || preferences.nodes.showDescriptions) && node.description && (
        <p className="node-description semantic-detail">{node.description}</p>
      )}
      {showInterfaces && interfaces.length > 0 && (
        <div className="interface-list semantic-essential">
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
        <div className="type-list semantic-detail">
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
      <NodePorts connectable={editable} />
    </>
  );
}
