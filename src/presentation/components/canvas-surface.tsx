import { useMemo } from 'react';
import {
  Background, BackgroundVariant, Controls, ReactFlow, type Connection, type NodeChange,
} from '@xyflow/react';
import type { CanvasEngine } from '../../application/canvas-engine';
import type { ArchitectureDocument, CanvasPreferences, Selection } from '../../domain/model';
import type { ArchitectureMap } from '../../domain/maps';
import { projectEdges, projectNodes } from '../projection';
import type { CanvasMode } from '../view-mode';
import { useLayoutPreview } from '../use-layout-preview';
import { ArchitectureNode } from '../nodes/architecture-node';
import { CommentNode } from '../nodes/comment-node';
import { ScopeNode } from '../nodes/scope-node';
import { TreeNode } from '../nodes/tree-node';
import { ElbowEdge } from '../edges/elbow-edge';
import { Legend } from './legend';
import { CanvasToolbar } from './canvas-toolbar';

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
  canGoBack: boolean;
  goBack: () => void;
  createDiagram: () => void;
  setDiagramStatus: (diagramId: string, status: 'active' | 'archived') => void;
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

function addNodeChanges(engine: CanvasEngine, editable: boolean, changes: NodeChange[]): void {
  if (editable) applyNodeChanges(engine, changes);
}

/** Interactive editor or clean, read-only presentation of one selected map. */
export function CanvasSurface(props: CanvasSurfaceProps) {
  const editable = props.mode === 'edit';
  const {
    currentProposal, displayDocument, fitRevision, interactionEnabled, layout, onSelectionChange,
  } = useLayoutPreview({
    document: props.document, preferences: props.preferences, engine: props.engine,
    maps: props.maps, activeMapId: props.activeMapId, editable,
  });
  const nodes = useMemo(
    () => projectNodes(displayDocument, props.preferences, props.selection, interactionEnabled, props.setSelection),
    [displayDocument, interactionEnabled, props.preferences, props.selection, props.setSelection],
  );
  const edges = useMemo(
    () => projectEdges(displayDocument, props.preferences, props.selection, interactionEnabled, props.setSelection),
    [displayDocument, interactionEnabled, props.preferences, props.selection, props.setSelection],
  );
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
        onSelectionChange={onSelectionChange}
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
