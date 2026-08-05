import type { ArchitectureDocument, CanvasCommand, Selection, WireKind } from '../../domain/model';
import { placementFor } from '../../domain/layouts';
import { WIRE_KIND_STYLES } from '../wire-styles';
import { Field } from './field';

const WIRE_KINDS = Object.keys(WIRE_KIND_STYLES) as WireKind[];

interface InspectPanelProps {
  document: ArchitectureDocument;
  /** Only what the open diagram contains, so the contents list matches what is on screen. */
  visibleDocument: ArchitectureDocument;
  selection: Selection;
  execute: (command: CanvasCommand) => void;
  clearSelection: () => void;
  select: (selection: Selection) => void;
  editable: boolean;
  openDiagram: (diagramId: string) => void;
}

function depthOf(document: ArchitectureDocument, nodeId: string): number {
  let depth = 0;
  let cursor = document.nodes[nodeId]?.parentId;
  while (cursor) {
    depth += 1;
    cursor = document.nodes[cursor]?.parentId;
  }
  return depth;
}

/**
 * What the panel shows when nothing is selected.
 *
 * It used to be one grey sentence in four hundred pixels of nothing. Listing what the open
 * diagram contains costs no extra chrome and turns the largest empty area on screen into the
 * fastest way to reach any object in it.
 */
function DiagramContents({ props }: { props: InspectPanelProps }) {
  const { visibleDocument: visible } = props;
  const nodes = Object.values(visible.nodes);
  const root = nodes.find((node) => node.kind === 'scope' && !node.parentId);
  const listed = nodes
    .filter((node) => node.id !== root?.id)
    .sort((left, right) => depthOf(visible, left.id) - depthOf(visible, right.id)
      || left.label.localeCompare(right.label));

  if (listed.length === 0) {
    return <div className="empty-inspector"><span className="empty-mark">⌁</span><span>Nothing drawn yet</span></div>;
  }

  return (
    <div className="diagram-contents">
      <header>
        <strong>{root?.label ?? visible.name}</strong>
        <small>{listed.length} objects · {Object.keys(visible.wires).length} wires</small>
      </header>
      <ul>
        {listed.map((node) => (
          <li key={node.id} style={{ paddingLeft: `${Math.min(depthOf(visible, node.id) - 1, 3) * 10}px` }}>
            <button onClick={() => props.select({ kind: 'node', id: node.id })} type="button">
              <span className="contents-kind">{node.kind}</span>
              <span className="contents-label">{node.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptySelection({ props }: { props: InspectPanelProps }) {
  return <DiagramContents props={props} />;
}

function NodeInspection({ props, id }: { props: InspectPanelProps; id: string }) {
  const node = props.document.nodes[id];
  if (!node) return <EmptySelection props={props} />;
  const placement = placementFor(props.document, node.id);
  const layout = props.document.layouts[props.document.activeLayoutId];
  const diagram = Object.values(props.document.diagrams).find((item) => item.rootNodeId === node.id);
  return (
    <div className="inspection">
      <div className="object-identity"><span>{node.kind}</span><strong>{node.label}</strong></div>
      <Field label="Name">
        <input disabled={!props.editable} value={node.label} onChange={(event) => props.execute({ kind: 'node.update', id, patch: { label: event.target.value } })} />
      </Field>
      <Field label="Description">
        <textarea disabled={!props.editable} value={node.description ?? ''} onChange={(event) => props.execute({ kind: 'node.update', id, patch: { description: event.target.value } })} />
      </Field>
      <div className="facts">
        <div><span>Interfaces</span><strong>{node.interfaceIds.length}</strong></div>
        <div><span>Types</span><strong>{node.typeIds.length}</strong></div>
        <div><span>Position</span><strong>{Math.round(placement.position.x)}, {Math.round(placement.position.y)}</strong></div>
      </div>
      {diagram && <Field label="Diagram status"><output>{diagram.status}</output></Field>}
      {node.subjectRef && (
        <Field label="Subject"><output>{node.subjectRef.namespace}:{node.subjectRef.id}</output></Field>
      )}
      <Field label="Detail diagram">
        <select
          disabled={!props.editable}
          onChange={(event) => props.execute({
            kind: 'node.setDetailDiagram', id,
            diagramId: event.target.value || undefined,
          })}
          value={node.expandsToDiagramId ?? ''}
        >
          <option value="">No linked detail</option>
          {Object.values(props.document.diagrams)
            .filter((item) => item.status === 'active' && item.rootNodeId !== node.id)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {props.document.nodes[item.rootNodeId]?.label ?? item.id}
              </option>
            ))}
        </select>
      </Field>
      {node.expandsToDiagramId && props.document.diagrams[node.expandsToDiagramId]?.status === 'active' && (
        <button onClick={() => props.openDiagram(node.expandsToDiagramId as string)} type="button">Open detail →</button>
      )}
      {props.editable && (
        <Field label="Lock position">
          <input
            checked={placement.pinned}
            onChange={(event) => props.execute({ kind: 'node.pin', id, pinned: event.target.checked })}
            type="checkbox"
          />
        </Field>
      )}
      {props.editable && node.kind === 'scope' && (
        <Field label="Collapse children">
          <input
            checked={layout.collapsedNodeIds.includes(node.id)}
            onChange={(event) => props.execute({ kind: 'node.setCollapsed', id, collapsed: event.target.checked })}
            type="checkbox"
          />
        </Field>
      )}
      {props.editable && node.kind !== 'scope' && (
        <button className="danger-action" onClick={() => { props.execute({ kind: 'node.remove', id }); props.clearSelection(); }} type="button">Delete object</button>
      )}
    </div>
  );
}

function InterfaceInspection({ props, id }: { props: InspectPanelProps; id: string }) {
  const item = props.document.interfaces[id];
  if (!item) return <EmptySelection props={props} />;
  return (
    <div className="inspection">
      <div className="object-identity"><span>interface</span><strong>{item.name}</strong></div>
      <Field label="Owner"><output>{props.document.nodes[item.ownerId]?.label ?? item.ownerId}</output></Field>
      <Field label="Accepts"><output>{item.accepts.join(', ') || 'Nothing'}</output></Field>
      <Field label="Returns"><output>{item.returns.join(', ') || 'void'}</output></Field>
      <pre className="object-json">{JSON.stringify(item, null, 2)}</pre>
    </div>
  );
}

function TypeInspection({ props, id }: { props: InspectPanelProps; id: string }) {
  const item = props.document.types[id];
  if (!item) return <EmptySelection props={props} />;
  const usedBy = Object.values(props.document.nodes).filter((node) => node.typeIds.includes(id));
  return (
    <div className="inspection">
      <div className="object-identity"><span>type</span><strong>{item.name}</strong></div>
      <div className="token-list">{item.fields.map((field) => <span key={field}>{field}</span>)}</div>
      <Field label="Used by"><output>{usedBy.map((node) => node.label).join(', ')}</output></Field>
      <pre className="object-json">{JSON.stringify(item, null, 2)}</pre>
    </div>
  );
}

function WireInspection({ props, id }: { props: InspectPanelProps; id: string }) {
  const wire = props.document.wires[id];
  if (!wire) return <EmptySelection props={props} />;
  return (
    <div className="inspection">
      <div className="object-identity"><span>wire · {wire.kind}</span><strong>{wire.label || 'Unlabelled'}</strong></div>
      <Field label="Label"><input disabled={!props.editable} value={wire.label} onChange={(event) => props.execute({ kind: 'wire.update', id, patch: { label: event.target.value } })} /></Field>
      <Field label="Kind">
        <select disabled={!props.editable} value={wire.kind} onChange={(event) => props.execute({ kind: 'wire.update', id, patch: { kind: event.target.value as WireKind } })}>
          {WIRE_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select>
      </Field>
      <Field label="From"><output>{props.document.nodes[wire.source]?.label ?? wire.source}</output></Field>
      <Field label="To"><output>{props.document.nodes[wire.target]?.label ?? wire.target}</output></Field>
      <Field label="Routing"><output>Elbow</output></Field>
      {props.editable && <button className="danger-action" onClick={() => { props.execute({ kind: 'wire.remove', id }); props.clearSelection(); }} type="button">Delete wire</button>}
    </div>
  );
}

function TreeRowInspection({ props, nodeId, rowId }: { props: InspectPanelProps; nodeId: string; rowId: string }) {
  const node = props.document.nodes[nodeId];
  const row = node?.rows?.find((item) => item.id === rowId);
  if (!node || !row) return <EmptySelection props={props} />;
  const parent = row.parentRowId ? node.rows?.find((item) => item.id === row.parentRowId) : undefined;
  return (
    <div className="inspection">
      <div className="object-identity"><span>{row.kind}</span><strong>{row.label ?? row.id}</strong></div>
      <Field label="Status"><output>{row.status ?? '—'}</output></Field>
      <Field label="Parent"><output>{parent ? parent.id : 'top level'}</output></Field>
      <Field label="In tree"><output>{node.label}</output></Field>
      {row.badges.length > 0 && (
        <div className="token-list">{row.badges.map((badge) => <span key={badge}>◆ {badge}</span>)}</div>
      )}
      <pre className="object-json">{JSON.stringify(row, null, 2)}</pre>
    </div>
  );
}

/** Inspects the currently selected domain object. */
export function InspectPanel(props: InspectPanelProps) {
  const selection = props.selection;
  if (!selection) return <EmptySelection props={props} />;
  if (selection.kind === 'node') return <NodeInspection props={props} id={selection.id} />;
  if (selection.kind === 'interface') return <InterfaceInspection props={props} id={selection.id} />;
  if (selection.kind === 'type') return <TypeInspection props={props} id={selection.id} />;
  if (selection.kind === 'tree-row') return <TreeRowInspection props={props} nodeId={selection.nodeId} rowId={selection.rowId} />;
  return <WireInspection props={props} id={selection.id} />;
}
