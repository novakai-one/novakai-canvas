import type { ArchitectureDocument, CanvasCommand, Selection } from '../../domain/model';
import { Field } from './field';

interface InspectPanelProps {
  document: ArchitectureDocument;
  selection: Selection;
  execute: (command: CanvasCommand) => void;
  clearSelection: () => void;
}

function EmptySelection() {
  return <div className="empty-inspector"><span className="empty-mark">⌁</span><span>Select any object or wire</span></div>;
}

function NodeInspection({ props, id }: { props: InspectPanelProps; id: string }) {
  const node = props.document.nodes[id];
  if (!node) return <EmptySelection />;
  return (
    <div className="inspection">
      <div className="object-identity"><span>{node.kind}</span><strong>{node.label}</strong></div>
      <Field label="Name">
        <input value={node.label} onChange={(event) => props.execute({ kind: 'node.update', id, patch: { label: event.target.value } })} />
      </Field>
      <Field label="Description">
        <textarea value={node.description ?? ''} onChange={(event) => props.execute({ kind: 'node.update', id, patch: { description: event.target.value } })} />
      </Field>
      <div className="facts">
        <div><span>Interfaces</span><strong>{node.interfaceIds.length}</strong></div>
        <div><span>Types</span><strong>{node.typeIds.length}</strong></div>
        <div><span>Position</span><strong>{Math.round(node.position.x)}, {Math.round(node.position.y)}</strong></div>
      </div>
      {node.kind !== 'scope' && (
        <button className="danger-action" onClick={() => { props.execute({ kind: 'node.remove', id }); props.clearSelection(); }} type="button">Delete object</button>
      )}
    </div>
  );
}

function InterfaceInspection({ props, id }: { props: InspectPanelProps; id: string }) {
  const item = props.document.interfaces[id];
  if (!item) return <EmptySelection />;
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
  if (!item) return <EmptySelection />;
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
  if (!wire) return <EmptySelection />;
  return (
    <div className="inspection">
      <div className="object-identity"><span>wire · {wire.kind}</span><strong>{wire.label || 'Unlabelled'}</strong></div>
      <Field label="Label"><input value={wire.label} onChange={(event) => props.execute({ kind: 'wire.update', id, patch: { label: event.target.value } })} /></Field>
      <Field label="From"><output>{props.document.nodes[wire.source]?.label ?? wire.source}</output></Field>
      <Field label="To"><output>{props.document.nodes[wire.target]?.label ?? wire.target}</output></Field>
      <Field label="Routing"><output>Elbow</output></Field>
      <button className="danger-action" onClick={() => { props.execute({ kind: 'wire.remove', id }); props.clearSelection(); }} type="button">Delete wire</button>
    </div>
  );
}

/** Inspects the currently selected domain object. */
export function InspectPanel(props: InspectPanelProps) {
  const selection = props.selection;
  if (!selection) return <EmptySelection />;
  if (selection.kind === 'node') return <NodeInspection props={props} id={selection.id} />;
  if (selection.kind === 'interface') return <InterfaceInspection props={props} id={selection.id} />;
  if (selection.kind === 'type') return <TypeInspection props={props} id={selection.id} />;
  return <WireInspection props={props} id={selection.id} />;
}
