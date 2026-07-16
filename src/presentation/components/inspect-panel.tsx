import type { ArchitectureDocument, CanvasCommand, Selection } from '../../domain/model';
import { Field } from './field';

interface InspectPanelProps {
  document: ArchitectureDocument;
  selection: Selection;
  execute: (command: CanvasCommand) => void;
  clearSelection: () => void;
}

function EmptySelection() {
  return (
    <div className="empty-inspector">
      <span className="empty-mark">⌁</span>
      <span>Select any object or wire</span>
    </div>
  );
}

export function InspectPanel({ document, selection, execute, clearSelection }: InspectPanelProps) {
  if (!selection) return <EmptySelection />;

  if (selection.kind === 'node') {
    const node = document.nodes[selection.id];
    if (!node) return <EmptySelection />;
    return (
      <div className="inspection">
        <div className="object-identity"><span>{node.kind}</span><strong>{node.label}</strong></div>
        <Field label="Name">
          <input value={node.label} onChange={(event) => execute({ kind: 'node.update', id: node.id, patch: { label: event.target.value } })} />
        </Field>
        <Field label="Description">
          <textarea value={node.description ?? ''} onChange={(event) => execute({ kind: 'node.update', id: node.id, patch: { description: event.target.value } })} />
        </Field>
        <div className="facts">
          <div><span>Interfaces</span><strong>{node.interfaceIds.length}</strong></div>
          <div><span>Types</span><strong>{node.typeIds.length}</strong></div>
          <div><span>Position</span><strong>{Math.round(node.position.x)}, {Math.round(node.position.y)}</strong></div>
        </div>
        {node.kind !== 'scope' && (
          <button className="danger-action" onClick={() => { execute({ kind: 'node.remove', id: node.id }); clearSelection(); }} type="button">
            Delete object
          </button>
        )}
      </div>
    );
  }

  if (selection.kind === 'interface') {
    const item = document.interfaces[selection.id];
    if (!item) return <EmptySelection />;
    return (
      <div className="inspection">
        <div className="object-identity"><span>interface</span><strong>{item.name}</strong></div>
        <Field label="Owner"><output>{document.nodes[item.ownerId]?.label ?? item.ownerId}</output></Field>
        <Field label="Accepts"><output>{item.accepts.join(', ') || 'Nothing'}</output></Field>
        <Field label="Returns"><output>{item.returns.join(', ') || 'void'}</output></Field>
        <pre className="object-json">{JSON.stringify(item, null, 2)}</pre>
      </div>
    );
  }

  if (selection.kind === 'type') {
    const item = document.types[selection.id];
    if (!item) return <EmptySelection />;
    const usedBy = Object.values(document.nodes).filter((node) => node.typeIds.includes(item.id));
    return (
      <div className="inspection">
        <div className="object-identity"><span>type</span><strong>{item.name}</strong></div>
        <div className="token-list">{item.fields.map((field) => <span key={field}>{field}</span>)}</div>
        <Field label="Used by"><output>{usedBy.map((node) => node.label).join(', ')}</output></Field>
        <pre className="object-json">{JSON.stringify(item, null, 2)}</pre>
      </div>
    );
  }

  const wire = document.wires[selection.id];
  if (!wire) return <EmptySelection />;
  return (
    <div className="inspection">
      <div className="object-identity"><span>wire · {wire.kind}</span><strong>{wire.label || 'Unlabelled'}</strong></div>
      <Field label="Label">
        <input value={wire.label} onChange={(event) => execute({ kind: 'wire.update', id: wire.id, patch: { label: event.target.value } })} />
      </Field>
      <Field label="From"><output>{document.nodes[wire.source]?.label ?? wire.source}</output></Field>
      <Field label="To"><output>{document.nodes[wire.target]?.label ?? wire.target}</output></Field>
      <Field label="Routing"><output>Elbow</output></Field>
      <button className="danger-action" onClick={() => { execute({ kind: 'wire.remove', id: wire.id }); clearSelection(); }} type="button">
        Delete wire
      </button>
    </div>
  );
}
