import { useState } from 'react';
import type { CanvasEngine } from '../../application/canvas-engine';
import type { DiagramSummary } from '../../application/canvas-library';
import type { ArchitectureDocument, Selection } from '../../domain/model';
import type { ArchitectureMap } from '../../domain/maps';
import { createCanvasNode, type CreatableNodeKind } from '../canvas-actions';
import type { LayoutPreviewActions } from '../use-layout-preview';
import type { CanvasMode } from '../view-mode';

export interface CanvasToolbarProps {
  document: ArchitectureDocument;
  engine: CanvasEngine;
  maps: ArchitectureMap[];
  /** Diagram list sourced from the v3 record library; when present, the picker lists these. */
  libraryDiagrams?: DiagramSummary[];
  activeMapId?: string;
  mode: CanvasMode;
  saveStatus: string;
  setSelection: (selection: Selection) => void;
  changeMap: (mapId: string) => void;
  changeMode: (mode: CanvasMode) => void;
  canGoBack: boolean;
  goBack: () => void;
  createDiagram: () => void;
  setDiagramStatus: (diagramId: string, status: 'active' | 'archived') => void;
}

function ModeSwitch({ props }: { props: CanvasToolbarProps }) {
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

/** Common shape the picker renders, whichever source (library or legacy document) supplied it. */
interface PickerOption { id: string; label: string; status: 'active' | 'archived' }

function DiagramPicker({
  props, query, setQuery, showArchived,
}: {
  props: CanvasToolbarProps;
  query: string;
  setQuery: (query: string) => void;
  showArchived: boolean;
}) {
  // The library is the record-model's proof of a real end-to-end read; when it built
  // successfully, the picker's list is sourced from it rather than the legacy document. Diagram
  // IDs are identical either way, so switching the map by ID below is unaffected.
  const options: PickerOption[] = props.libraryDiagrams
    ? props.libraryDiagrams.map((entry) => ({ id: entry.id, label: entry.name, status: entry.status }))
    : props.maps;
  const visibleMaps = options.filter((map) =>
    (showArchived || map.status === 'active')
    && (map.id === props.activeMapId || map.label.toLowerCase().includes(query.toLowerCase())));
  return (
    <label className="map-picker">
      <span>Diagram</span>
      <input aria-label="Find diagram" onChange={(event) => setQuery(event.target.value)} placeholder="Find" type="search" value={query} />
      <select aria-label="Map" disabled={props.maps.length === 0} value={props.activeMapId ?? ''} onChange={(event) => props.changeMap(event.target.value)}>
        {visibleMaps.map((map) => <option key={map.id} value={map.id}>{map.label}{map.status === 'archived' ? ' · archived' : ''}</option>)}
      </select>
    </label>
  );
}

function AddObjectSelect({ props, activeMap }: { props: CanvasToolbarProps; activeMap?: ArchitectureMap }) {
  const add = (kind: CreatableNodeKind): void => {
    if (!activeMap) return;
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const created = createCanvasNode(props.document, activeMap.rootNodeId, kind, id);
    props.engine.execute({ kind: 'node.add', ...created });
    props.setSelection({ kind: 'node', id: created.node.id });
  };
  return (
    <select aria-label="Add object" disabled={!activeMap} onChange={(event) => {
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
  props, activeMap, showArchived, toggleArchived,
}: {
  props: CanvasToolbarProps;
  activeMap?: ArchitectureMap;
  showArchived: boolean;
  toggleArchived: () => void;
}) {
  const act = (action: string): void => {
    if (action === 'new') props.createDiagram();
    if (action === 'status' && activeMap) {
      props.setDiagramStatus(activeMap.id, activeMap.status === 'active' ? 'archived' : 'active');
    }
    if (action === 'archived') toggleArchived();
  };
  return (
    <select aria-label="Diagram actions" onChange={(event) => { act(event.target.value); event.target.value = ''; }} value="">
      <option value="">Diagram…</option>
      <option value="new">New diagram</option>
      {activeMap && <option value="status">{activeMap.status === 'active' ? 'Archive current' : 'Restore current'}</option>}
      {props.maps.some((map) => map.status === 'archived') && (
        <option value="archived">{showArchived ? 'Hide archived' : 'Show archived'}</option>
      )}
    </select>
  );
}

function EditActions({
  props, layout, showArchived, toggleArchived,
}: {
  props: CanvasToolbarProps;
  layout: LayoutPreviewActions;
  showArchived: boolean;
  toggleArchived: () => void;
}) {
  const activeMap = props.maps.find((map) => map.id === props.activeMapId);
  if (layout.proposal) return <div className="toolbar-actions">
    <button onClick={layout.apply} type="button">Apply preview · {layout.proposal.affectedNodeIds.length}</button>
    <button onClick={layout.cancel} type="button">Cancel</button>
  </div>;
  return <div className="toolbar-actions">
    <button disabled={!activeMap} onClick={layout.preview} type="button">
      {layout.selectedNodeCount > 0 ? `Preview selected · ${layout.selectedNodeCount}` : 'Preview map layout'}
    </button>
    <button disabled={!props.engine.canUndo()} onClick={layout.undo} type="button">Undo</button>
    <AddObjectSelect activeMap={activeMap} props={props} />
    <DiagramActionSelect activeMap={activeMap} props={props} showArchived={showArchived} toggleArchived={toggleArchived} />
  </div>;
}

/** Compact, composable chrome for mode, diagram discovery, and edit intentions. */
export function CanvasToolbar({ props, layout }: { props: CanvasToolbarProps; layout: LayoutPreviewActions }) {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  return (
    <div className="canvas-toolbar">
      <ModeSwitch props={props} />
      {props.canGoBack && <button onClick={props.goBack} type="button">← Back</button>}
      <DiagramPicker props={props} query={query} setQuery={setQuery} showArchived={showArchived} />
      {props.mode === 'edit' && (
        <EditActions props={props} layout={layout} showArchived={showArchived} toggleArchived={() => setShowArchived((shown) => !shown)} />
      )}
      <div className="file-identity"><span>{props.document.name}</span><small>r{props.document.revision}</small></div>
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
