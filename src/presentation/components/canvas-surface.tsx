import { useMemo } from 'react';
import {
  Background, BackgroundVariant, Controls, ReactFlow, type Connection, type NodeChange,
} from '@xyflow/react';
import type { DiagramSummary } from '../../application/canvas-library';
import type { RecordCommand } from '../../application/canvas-workspace';
import { asId } from '../../domain/id-cast';
import type { NodeId, WireId } from '../../domain/ids';
import type { CanvasPreferences, Selection } from '../../domain/model';
import type { ProjectedView } from '../../domain/project-view';
import type { DiagramRecord } from '../../domain/records';
import { projectEdges, projectNodes } from '../projection';
import type { CanvasMode } from '../view-mode';
import { ArchitectureNode } from '../nodes/architecture-node';
import { CommentNode } from '../nodes/comment-node';
import { ScopeNode } from '../nodes/scope-node';
import { TreeNode } from '../nodes/tree-node';
import { ElbowEdge } from '../edges/elbow-edge';
import { Legend } from './legend';
import { CanvasToolbar } from './canvas-toolbar';

const nodeTypes = { architecture: ArchitectureNode, comment: CommentNode, scope: ScopeNode, tree: TreeNode };
const edgeTypes = { elbow: ElbowEdge };

/** Everything the canvas and its toolbar need from the open diagram and from the library. */
export interface CanvasSurfaceProps {
  record: DiagramRecord;
  view: ProjectedView;
  preferences: CanvasPreferences;
  selection: Selection;
  setSelection: (selection: Selection) => void;
  /** The one way the canvas changes anything; every intention reaches the open workspace here. */
  execute: (command: RecordCommand) => void;
  saveStatus: string;
  diagrams: DiagramSummary[];
  activeDiagramId: string;
  mode: CanvasMode;
  changeDiagram: (diagramId: string) => void;
  changeMode: (mode: CanvasMode) => void;
  canGoBack: boolean;
  goBack: () => void;
  canUndo: boolean;
  undo: () => void;
  createDiagram: () => void;
  setDiagramStatus: (diagramId: string, status: 'active' | 'archived') => void;
}

function applyNodeChanges(execute: (command: RecordCommand) => void, changes: NodeChange[]): void {
  changes.forEach((change) => {
    if (change.type === 'position' && change.position) {
      execute({ kind: 'node.move', id: change.id, position: change.position });
    }
    // Only user-driven resizes (NodeResizer sets resizing) — never React Flow's
    // initial DOM measurements, which would rewrite every stored size on load.
    if (change.type === 'dimensions' && change.dimensions && change.resizing) {
      execute({ kind: 'node.resize', id: change.id, size: change.dimensions });
    }
    if (change.type === 'remove') execute({ kind: 'node.remove', id: change.id });
  });
}

function connect(execute: (command: RecordCommand) => void, connection: Connection): string | null {
  if (!connection.source || !connection.target) return null;
  const id = `wire-${crypto.randomUUID().slice(0, 8)}`;
  execute({
    kind: 'wire.add',
    wire: {
      id: asId<WireId>(id),
      kind: 'references',
      label: 'connects',
      source: { nodeId: asId<NodeId>(connection.source) },
      target: { nodeId: asId<NodeId>(connection.target) },
    },
  });
  return id;
}

/** Interactive editor or clean, read-only presentation of one open diagram record. */
export function CanvasSurface(props: CanvasSurfaceProps) {
  const {
    activeDiagramId, execute, mode, preferences, record, selection, setSelection, view,
  } = props;
  const editable = mode === 'edit';
  const nodes = useMemo(
    () => projectNodes({ view, record, preferences, selection, editable, select: setSelection }),
    [editable, preferences, record, selection, setSelection, view],
  );
  const edges = useMemo(
    () => projectEdges({ view, record, preferences, selection, editable, select: setSelection }),
    [editable, preferences, record, selection, setSelection, view],
  );
  return (
    <main className={`canvas-surface is-${mode}`}>
      <ReactFlow
        key={`${mode}:${activeDiagramId}`}
        colorMode={preferences.appearance.theme} deleteKeyCode={editable ? ['Backspace', 'Delete'] : null} edgeTypes={edgeTypes} edges={edges}
        edgesReconnectable={editable} elementsSelectable fitView fitViewOptions={{ padding: editable ? 0.12 : 0.05, maxZoom: 1 }} minZoom={0.35}
        nodeTypes={nodeTypes} nodes={nodes} nodesConnectable={editable} nodesDraggable={editable}
        onConnect={(connection) => { if (!editable) return; const id = connect(execute, connection); if (id) setSelection({ kind: 'wire', id }); }}
        onEdgeClick={(_event, edge) => setSelection({ kind: 'wire', id: edge.id })}
        onReconnect={(edge, connection) => {
          if (!editable || !connection.source || !connection.target) return;
          execute({
            kind: 'wire.reconnect', id: edge.id, source: connection.source, target: connection.target,
          });
          setSelection({ kind: 'wire', id: edge.id });
        }}
        onNodeClick={(_event, node) => setSelection({ kind: 'node', id: node.id })}
        onNodesChange={(changes) => { if (editable) applyNodeChanges(execute, changes); }} onPaneClick={() => setSelection(null)}
        selectionOnDrag={editable} snapGrid={[preferences.canvas.gridSize, preferences.canvas.gridSize]}
        snapToGrid={editable && preferences.canvas.snapToGrid}
      >
        {preferences.canvas.showGrid && editable && <Background color={preferences.appearance.theme === 'light' ? '#d9d4c8' : '#34312b'} gap={preferences.canvas.gridSize * 2} variant={BackgroundVariant.Dots} />}
        {preferences.canvas.showControls && <Controls position="bottom-left" showInteractive={false} />}
      </ReactFlow>
      <Legend preferences={preferences} view={view} />
      <CanvasToolbar props={props} />
    </main>
  );
}
