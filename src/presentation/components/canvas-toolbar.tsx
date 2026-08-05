import { useState } from 'react';
import { createCanvasNode, rootGroupId, type CreatableNodeKind } from '../canvas-actions';
import type { CanvasSurfaceProps } from './canvas-surface';

function ModeSwitch({ props }: { props: CanvasSurfaceProps }) {
  return (
    <div className="mode-switch" aria-label="Canvas mode">
      {(['present', 'edit'] as const).map((mode) => (
        <button className={props.mode === mode ? 'is-active' : ''} key={mode} onClick={() => props.changeMode(mode)} type="button">
          {mode === 'present' ? 'Present' : 'Edit'}
        </button>
      ))}
    </div>
  );
}

function DiagramPicker({
  props, query, setQuery, showArchived,
}: {
  props: CanvasSurfaceProps;
  query: string;
  setQuery: (query: string) => void;
  showArchived: boolean;
}) {
  // The library index is the only source of this list. Its entries are a projection over the
  // records themselves, so the picker cannot offer a diagram that has no record behind it.
  const listed = props.diagrams.filter((entry) =>
    (showArchived || entry.status === 'active')
    && (entry.id === props.activeDiagramId || entry.name.toLowerCase().includes(query.toLowerCase())));
  return (
    <label className="map-picker">
      <span>Diagram</span>
      <input aria-label="Find diagram" onChange={(event) => setQuery(event.target.value)} placeholder="Find" type="search" value={query} />
      <select aria-label="Map" disabled={props.diagrams.length === 0} value={props.activeDiagramId} onChange={(event) => props.changeDiagram(event.target.value)}>
        {listed.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.status === 'archived' ? ' · archived' : ''}</option>)}
      </select>
    </label>
  );
}

function AddObjectSelect({ props }: { props: CanvasSurfaceProps }) {
  const add = (kind: CreatableNodeKind): void => {
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const created = createCanvasNode(props.record, rootGroupId(props.record), kind, id);
    props.execute({ kind: 'node.add', ...created });
    props.setSelection({ kind: 'node', id: created.node.id });
  };
  return (
    <select aria-label="Add object" onChange={(event) => {
      if (event.target.value) add(event.target.value as CreatableNodeKind);
      event.target.value = '';
    }} value="">
      <option value="">＋ Add</option>
      {(['module', 'object', 'runtime', 'resource', 'group', 'comment'] as const)
        .map((kind) => <option key={kind} value={kind}>{kind[0].toUpperCase()}{kind.slice(1)}</option>)}
    </select>
  );
}

function DiagramActionSelect({
  props, showArchived, toggleArchived,
}: {
  props: CanvasSurfaceProps;
  showArchived: boolean;
  toggleArchived: () => void;
}) {
  const active = props.record.status === 'active';
  const act = (action: string): void => {
    if (action === 'new') props.createDiagram();
    if (action === 'status') {
      props.setDiagramStatus(props.activeDiagramId, active ? 'archived' : 'active');
    }
    if (action === 'archived') toggleArchived();
  };
  return (
    <select aria-label="Diagram actions" onChange={(event) => { act(event.target.value); event.target.value = ''; }} value="">
      <option value="">Diagram…</option>
      <option value="new">New diagram</option>
      <option value="status">{active ? 'Archive current' : 'Restore current'}</option>
      {props.diagrams.some((entry) => entry.status === 'archived') && (
        <option value="archived">{showArchived ? 'Hide archived' : 'Show archived'}</option>
      )}
    </select>
  );
}

function EditActions({
  props, showArchived, toggleArchived,
}: {
  props: CanvasSurfaceProps;
  showArchived: boolean;
  toggleArchived: () => void;
}) {
  return (
    <div className="toolbar-actions">
      <button disabled={!props.canUndo} onClick={props.undo} type="button">Undo</button>
      <AddObjectSelect props={props} />
      <DiagramActionSelect props={props} showArchived={showArchived} toggleArchived={toggleArchived} />
    </div>
  );
}

/** Compact, composable chrome for mode, diagram discovery, and edit intentions. */
export function CanvasToolbar({ props }: { props: CanvasSurfaceProps }) {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  return (
    <div className="canvas-toolbar">
      <ModeSwitch props={props} />
      {props.canGoBack && <button onClick={props.goBack} type="button">← Back</button>}
      <DiagramPicker props={props} query={query} setQuery={setQuery} showArchived={showArchived} />
      {props.mode === 'edit' && (
        <EditActions props={props} showArchived={showArchived} toggleArchived={() => setShowArchived((shown) => !shown)} />
      )}
      <div className="file-identity"><span>{props.record.name}</span><small>r{props.record.revision}</small></div>
      {props.mode === 'edit' && (
        <span
          className="save-status"
          data-state={props.saveStatus === 'Saved' || props.saveStatus === 'Saving' ? 'clean' : 'unsaved'}
          role="status"
        >
          {props.saveStatus}
        </span>
      )}
    </div>
  );
}
