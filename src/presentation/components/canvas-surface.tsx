import { useEffect, useMemo, useState } from 'react';
import {
  Background, BackgroundVariant, Controls, ReactFlow, type Connection, type NodeChange,
} from '@xyflow/react';
import type { CanvasEngine } from '../../application/canvas-engine';
import { applyLayoutProposal, previewLayout } from '../../domain/layout-proposal';
import type { ArchitectureDocument, CanvasPreferences, LayoutProposal, Selection } from '../../domain/model';
import type { ArchitectureMap } from '../../domain/maps';
import { createCanvasNode, type CreatableNodeKind } from '../canvas-actions';
import { projectEdges, projectNodes } from '../projection';
import type { CanvasMode } from '../view-mode';
import { ArchitectureNode } from '../nodes/architecture-node';
import { CommentNode } from '../nodes/comment-node';
import { ScopeNode } from '../nodes/scope-node';
import { TreeNode } from '../nodes/tree-node';
import { ElbowEdge } from '../edges/elbow-edge';
import { Legend } from './legend';

const nodeTypes = { architecture: ArchitectureNode, comment: CommentNode, scope: ScopeNode, tree: TreeNode };
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

interface LayoutActions {
  apply(): void;
  cancel(): void;
  preview(): void;
  undo(): void;
  proposal: LayoutProposal | null;
  selectedNodeCount: number;
}

function CanvasToolbar({ props, layout }: { props: CanvasSurfaceProps; layout: LayoutActions }) {
  const add = (kind: CreatableNodeKind): void => {
    if (!props.activeMapId) return;
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const created = createCanvasNode(props.document, props.activeMapId, kind, id);
    props.engine.execute({ kind: 'node.add', ...created });
    props.setSelection({ kind: 'node', id: created.node.id });
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
          {layout.proposal ? <>
            <button onClick={layout.apply} type="button">Apply preview · {layout.proposal.affectedNodeIds.length}</button>
            <button onClick={layout.cancel} type="button">Cancel</button>
          </> : <>
            <button disabled={!props.activeMapId} onClick={layout.preview} type="button">
              {layout.selectedNodeCount > 0 ? `Preview selected · ${layout.selectedNodeCount}` : 'Preview map layout'}
            </button>
            <button disabled={!props.engine.canUndo()} onClick={layout.undo} type="button">Undo</button>
            <select
              aria-label="Add object"
              disabled={!props.activeMapId}
              onChange={(event) => {
                if (event.target.value) add(event.target.value as CreatableNodeKind);
                event.target.value = '';
              }}
              value=""
            >
              <option value="">＋ Add</option>
              <option value="module">Module</option>
              <option value="object">Object</option>
              <option value="runtime">Runtime</option>
              <option value="resource">Resource</option>
              <option value="group">Group</option>
              <option value="comment">Comment</option>
            </select>
          </>}
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
  const [proposal, setProposal] = useState<LayoutProposal | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const currentProposal = proposal?.baseRevision === props.document.revision ? proposal : null;
  useEffect(() => {
    if (proposal && !currentProposal) setProposal(null);
  }, [currentProposal, proposal]);
  const displayDocument = useMemo(
    () => currentProposal ? applyLayoutProposal(props.document, currentProposal) : props.document,
    [currentProposal, props.document],
  );
  const interactionEnabled = editable && !currentProposal;
  const nodes = useMemo(
    () => projectNodes(displayDocument, props.preferences, props.selection, interactionEnabled, props.setSelection),
    [displayDocument, interactionEnabled, props.preferences, props.selection, props.setSelection],
  );
  const edges = useMemo(
    () => projectEdges(displayDocument, props.preferences, props.selection, interactionEnabled, props.setSelection),
    [displayDocument, interactionEnabled, props.preferences, props.selection, props.setSelection],
  );
  const preview = (): void => {
    if (!props.activeMapId) return;
    const selectedScope = selectedNodeIds.length === 1
      && props.document.nodes[selectedNodeIds[0]]?.kind === 'scope'
      ? selectedNodeIds[0]
      : undefined;
    setProposal(previewLayout(props.document, {
      target: selectedScope
        ? { kind: 'scope', scopeId: selectedScope }
        : selectedNodeIds.length > 0
          ? { kind: 'nodes', nodeIds: selectedNodeIds }
          : { kind: 'scope', scopeId: props.activeMapId },
      groupPadding: props.preferences.canvas.groupPadding,
    }));
  };
  const applyPreview = (): void => {
    if (!currentProposal) return;
    props.engine.execute({ kind: 'layout.apply', proposal: currentProposal });
    setProposal(null);
    setFitRevision((revision) => revision + 1);
  };
  const cancelPreview = (): void => setProposal(null);
  const undo = (): void => {
    if (!props.engine.undo()) return;
    setProposal(null);
    setFitRevision((revision) => revision + 1);
  };
  const layout: LayoutActions = {
    apply: applyPreview,
    cancel: cancelPreview,
    preview,
    undo,
    proposal: currentProposal,
    selectedNodeCount: selectedNodeIds.length,
  };
  return (
    <main className={`canvas-surface is-${props.mode}${currentProposal ? ' has-layout-preview' : ''}`}>
      <ReactFlow
        key={`${props.mode}:${props.activeMapId ?? 'empty'}:${fitRevision}`}
        colorMode={props.preferences.appearance.theme} deleteKeyCode={interactionEnabled ? ['Backspace', 'Delete'] : null} edgeTypes={edgeTypes} edges={edges}
        edgesReconnectable={interactionEnabled} elementsSelectable fitView fitViewOptions={{ padding: editable ? 0.12 : 0.05, maxZoom: 1 }} minZoom={0.35}
        nodeTypes={nodeTypes} nodes={nodes} nodesConnectable={interactionEnabled} nodesDraggable={interactionEnabled}
        onConnect={(connection) => { if (!interactionEnabled) return; const id = connect(props.engine, connection); if (id) props.setSelection({ kind: 'wire', id }); }}
        onEdgeClick={(_event, edge) => props.setSelection({ kind: 'wire', id: edge.id })}
        onReconnect={(edge, connection) => {
          if (!interactionEnabled || !connection.source || !connection.target) return;
          props.engine.execute({
            kind: 'wire.reconnect', id: edge.id, source: connection.source, target: connection.target,
          });
          props.setSelection({ kind: 'wire', id: edge.id });
        }}
        onNodeClick={(_event, node) => props.setSelection({ kind: 'node', id: node.id })}
        onNodesChange={(changes) => addNodeChanges(props.engine, interactionEnabled, changes)} onPaneClick={() => props.setSelection(null)}
        onSelectionChange={({ nodes: selectedNodes }) => setSelectedNodeIds(selectedNodes.map((node) => node.id).sort())}
        selectionOnDrag={interactionEnabled} snapGrid={[props.preferences.canvas.gridSize, props.preferences.canvas.gridSize]}
        snapToGrid={interactionEnabled && props.preferences.canvas.snapToGrid}
      >
        {props.preferences.canvas.showGrid && editable && <Background color={props.preferences.appearance.theme === 'light' ? '#d9d4c8' : '#34312b'} gap={props.preferences.canvas.gridSize * 2} variant={BackgroundVariant.Dots} />}
        {props.preferences.canvas.showControls && <Controls position="bottom-left" showInteractive={false} />}
      </ReactFlow>
      <Legend document={props.document} preferences={props.preferences} />
      <CanvasToolbar layout={layout} props={props} />
    </main>
  );
}
