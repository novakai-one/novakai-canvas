import { useMemo, useState } from 'react';
import {
  Background, BackgroundVariant, Controls, ReactFlow, type Connection, type NodeChange,
} from '@xyflow/react';
import type { CanvasEngine } from '../../application/canvas-engine';
import type { ArchitectureDocument, CanvasPreferences, Selection } from '../../domain/model';
import type { ArchitectureMap } from '../../domain/maps';
import { createCanvasNode } from '../canvas-actions';
import { projectEdges, projectNodes } from '../projection';
import type { CanvasMode } from '../view-mode';
import { ArchitectureNode } from '../nodes/architecture-node';
import { CommentNode } from '../nodes/comment-node';
import { ScopeNode } from '../nodes/scope-node';
import { ElbowEdge } from '../edges/elbow-edge';

const nodeTypes = { architecture: ArchitectureNode, comment: CommentNode, scope: ScopeNode };
const edgeTypes = { elbow: ElbowEdge };

interface CanvasSurfaceProps {
  document: ArchitectureDocument;
  preferences: CanvasPreferences;
  selection: Selection;
  setSelection: (selection: Selection) => void;
  engine: CanvasEngine;
  saveStatus: string;
  maps: ArchitectureMap[];
  activeMapId?: string;
  mode: CanvasMode;
  changeMap: (mapId: string) => void;
  changeMode: (mode: CanvasMode) => void;
}

function applyNodeChanges(engine: CanvasEngine, changes: NodeChange[]): void {
  changes.forEach((change) => {
    if (change.type === 'position' && change.position) {
      engine.execute({ kind: 'node.move', id: change.id, position: change.position });
    }
    // Only user-driven resizes (NodeResizer sets resizing) — never React Flow's
    // initial DOM measurements, which would rewrite every stored size on load.
    if (change.type === 'dimensions' && change.dimensions && change.resizing) {
      engine.execute({ kind: 'node.resize', id: change.id, size: change.dimensions });
    }
    if (change.type === 'remove') engine.execute({ kind: 'node.remove', id: change.id });
  });
}

function connect(engine: CanvasEngine, connection: Connection): string | null {
  if (!connection.source || !connection.target) return null;
  const id = `wire-${crypto.randomUUID().slice(0, 8)}`;
  engine.execute({
    kind: 'wire.add',
    wire: { id, source: connection.source, target: connection.target, label: 'connects', kind: 'references', routing: 'elbow' },
  });
  return id;
}

function CanvasToolbar({ props, layout }: { props: CanvasSurfaceProps; layout: () => void }) {
  const add = (kind: 'module' | 'comment'): void => {
    if (!props.activeMapId) return;
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const node = createCanvasNode(props.document, props.activeMapId, kind, id);
    props.engine.execute({ kind: 'node.add', node });
    props.setSelection({ kind: 'node', id: node.id });
  };
  return (
    <div className="canvas-toolbar">
      <div className="mode-switch" aria-label="Canvas mode">
        {(['present', 'edit'] as const).map((mode) => (
          <button className={props.mode === mode ? 'is-active' : ''} key={mode} onClick={() => props.changeMode(mode)} type="button">
            {mode === 'present' ? 'Present' : 'Edit'}
          </button>
        ))}
      </div>
      <label className="map-picker">
        <span>Map</span>
        <select aria-label="Map" disabled={props.maps.length === 0} value={props.activeMapId ?? ''} onChange={(event) => props.changeMap(event.target.value)}>
          {props.maps.map((map) => <option key={map.id} value={map.id}>{map.label}</option>)}
        </select>
      </label>
      {props.mode === 'edit' && (
        <div className="toolbar-actions">
          <button disabled={!props.activeMapId} onClick={layout} type="button">Auto-layout</button>
          <button disabled={!props.activeMapId} onClick={() => add('module')} type="button"><span>＋</span>Node</button>
          <button disabled={!props.activeMapId} onClick={() => add('comment')} type="button"><span>＋</span>Comment</button>
        </div>
      )}
      <div className="file-identity"><span>{props.document.name}</span><small>r{props.document.revision}</small></div>
      {props.mode === 'edit' && <span className="save-status">{props.saveStatus}</span>}
    </div>
  );
}

function addNodeChanges(engine: CanvasEngine, editable: boolean, changes: NodeChange[]): void {
  if (editable) applyNodeChanges(engine, changes);
}

/** Interactive editor or clean, read-only presentation of one selected map. */
export function CanvasSurface(props: CanvasSurfaceProps) {
  const editable = props.mode === 'edit';
  const [fitRevision, setFitRevision] = useState(0);
  const nodes = useMemo(
    () => projectNodes(props.document, props.preferences, props.selection, editable, props.setSelection),
    [editable, props.document, props.preferences, props.selection, props.setSelection],
  );
  const edges = useMemo(
    () => projectEdges(props.document, props.preferences, props.selection, editable, props.setSelection),
    [editable, props.document, props.preferences, props.selection, props.setSelection],
  );
  const layout = (): void => {
    if (!props.activeMapId) return;
    props.engine.execute({ kind: 'scope.layout', id: props.activeMapId });
    setFitRevision((revision) => revision + 1);
  };
  return (
    <main className={`canvas-surface is-${props.mode}`}>
      <ReactFlow
        key={`${props.mode}:${props.activeMapId ?? 'empty'}:${fitRevision}`}
        colorMode="dark" deleteKeyCode={editable ? ['Backspace', 'Delete'] : null} edgeTypes={edgeTypes} edges={edges}
        elementsSelectable fitView fitViewOptions={{ padding: editable ? 0.12 : 0.05, maxZoom: 1 }} minZoom={0.35}
        nodeTypes={nodeTypes} nodes={nodes} nodesConnectable={editable} nodesDraggable={editable}
        onConnect={(connection) => { if (!editable) return; const id = connect(props.engine, connection); if (id) props.setSelection({ kind: 'wire', id }); }}
        onEdgeClick={(_event, edge) => props.setSelection({ kind: 'wire', id: edge.id })}
        onNodeClick={(_event, node) => props.setSelection({ kind: 'node', id: node.id })}
        onNodesChange={(changes) => addNodeChanges(props.engine, editable, changes)} onPaneClick={() => props.setSelection(null)}
        selectionOnDrag={editable} snapGrid={[props.preferences.canvas.gridSize, props.preferences.canvas.gridSize]}
        snapToGrid={editable && props.preferences.canvas.snapToGrid}
      >
        {props.preferences.canvas.showGrid && editable && <Background color="#34312b" gap={props.preferences.canvas.gridSize * 2} variant={BackgroundVariant.Dots} />}
        {props.preferences.canvas.showControls && <Controls position="bottom-left" showInteractive={false} />}
      </ReactFlow>
      <CanvasToolbar layout={layout} props={props} />
    </main>
  );
}
