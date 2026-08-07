import { useState } from 'react';
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import { NodePorts } from './node-ports';
import type { ArchitectureNodeData } from '../projection';

type ArchitectureFlowNode = Node<ArchitectureNodeData, 'architecture'>;

/**
 * A node's name, edited where the node is.
 *
 * Chris: "adding a node doesn't allow me to add interface or edit the node. Cant edit the node
 * title or body… I can edit in the right panel, not amazing." Renaming is the most common edit
 * there is, and sending it across the screen to a form makes the diagram feel like a viewer.
 * Double-click opens it, Enter commits, Escape restores what was there — and the keystrokes are
 * kept off the canvas while typing, or Escape would deselect and Delete would remove the node
 * being renamed.
 */
function NodeLabel({
  editable, label, rename,
}: {
  label: string;
  editable: boolean;
  rename: (next: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null) {
    return (
      <span
        className={`node-label${editable ? ' is-renamable' : ''}`}
        onDoubleClick={editable ? (event) => { event.stopPropagation(); setDraft(label); } : undefined}
        title={editable ? 'Double-click to rename' : undefined}
      >{label}
      </span>
    );
  }
  const commit = (): void => {
    if (draft.trim().length > 0 && draft !== label) rename(draft.trim());
    setDraft(null);
  };
  return (
    <input
      autoFocus
      className="node-label-input nodrag nopan"
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') setDraft(null);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      value={draft}
    />
  );
}

/** Selectable architecture node with interface and type children. */
export function ArchitectureNode({ data, selected }: NodeProps<ArchitectureFlowNode>) {
  const { node, interfaces, types, preferences, selection, editable, select } = data;
  const showInterfaces = !editable || preferences.nodes.showInterfaces === 'always'
    || (preferences.nodes.showInterfaces === 'selected' && selected);
  const portsClass = preferences.nodes.showPorts === 'always' ? 'ports-always' : '';

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
      <article className={`architecture-node kind-${node.kind} ${portsClass}`}>
        <NodeResizer isVisible={editable && selected} minHeight={80} minWidth={160} onResizeEnd={() => data.resizeEnd?.(node.id as string)} />
        <header className="node-header">
        <NodeLabel
          editable={editable}
          label={node.label}
          rename={(next) => data.rename?.(node.id as string, next)}
        />
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
      <NodePorts connectable={editable} />
    </>
  );
}
