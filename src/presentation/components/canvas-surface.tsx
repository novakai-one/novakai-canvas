import { useMemo } from 'react';
import {
  Background, BackgroundVariant, Controls, ReactFlow, type Connection, type NodeChange,
} from '@xyflow/react';
import type { CanvasEngine } from '../../application/canvas-engine';
import type { ArchitectureDocument, CanvasNode, CanvasPreferences, Selection } from '../../domain/model';
import { projectEdges, projectNodes } from '../projection';
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
}

function createNode(document: ArchitectureDocument, kind: 'module' | 'comment'): CanvasNode {
  const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
  const count = Object.keys(document.nodes).length;
  return {
    id,
    kind,
    label: kind === 'comment' ? 'Add context here' : 'New module',
    position: kind === 'comment'
      ? { x: 1240, y: 280 + (count % 4) * 130 }
      : { x: 120 + (count % 4) * 230, y: 260 + (count % 3) * 150 },
    size: kind === 'comment' ? { width: 240, height: 100 } : { width: 200, height: 110 },
    parentId: kind === 'module' ? 'project-scope' : undefined,
    interfaceIds: [],
    typeIds: [],
  };
}

function applyNodeChanges(engine: CanvasEngine, changes: NodeChange[]): void {
  changes.forEach((change) => {
    if (change.type === 'position' && change.position) {
      engine.execute({ kind: 'node.move', id: change.id, position: change.position });
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

function CanvasToolbar({ props }: { props: CanvasSurfaceProps }) {
  const add = (kind: 'module' | 'comment'): void => {
    const node = createNode(props.document, kind);
    props.engine.execute({ kind: 'node.add', node });
    props.setSelection({ kind: 'node', id: node.id });
  };
  return (
    <div className="canvas-toolbar">
      <div className="file-identity"><span>{props.document.name}</span><small>r{props.document.revision}</small></div>
      <div className="toolbar-actions">
        <button onClick={() => add('module')} type="button"><span>＋</span>Node</button>
        <button onClick={() => add('comment')} type="button"><span>＋</span>Comment</button>
      </div>
      <span className="save-status">{props.saveStatus}</span>
    </div>
  );
}

/** Interactive projection of one architecture document. */
export function CanvasSurface(props: CanvasSurfaceProps) {
  const nodes = useMemo(
    () => projectNodes(props.document, props.preferences, props.selection, props.setSelection),
    [props.document, props.preferences, props.selection, props.setSelection],
  );
  const edges = useMemo(
    () => projectEdges(props.document, props.preferences, props.selection, props.setSelection),
    [props.document, props.preferences, props.selection, props.setSelection],
  );
  return (
    <main className="canvas-surface">
      <ReactFlow
        colorMode="dark" deleteKeyCode={['Backspace', 'Delete']} edgeTypes={edgeTypes} edges={edges}
        elementsSelectable fitView fitViewOptions={{ padding: 0.12, maxZoom: 1 }} minZoom={0.35}
        nodeTypes={nodeTypes} nodes={nodes} nodesConnectable nodesDraggable
        onConnect={(connection) => { const id = connect(props.engine, connection); if (id) props.setSelection({ kind: 'wire', id }); }}
        onEdgeClick={(_event, edge) => props.setSelection({ kind: 'wire', id: edge.id })}
        onNodeClick={(_event, node) => props.setSelection({ kind: 'node', id: node.id })}
        onNodesChange={(changes) => applyNodeChanges(props.engine, changes)} onPaneClick={() => props.setSelection(null)}
        selectionOnDrag snapGrid={[props.preferences.canvas.gridSize, props.preferences.canvas.gridSize]}
        snapToGrid={props.preferences.canvas.snapToGrid}
      >
        {props.preferences.canvas.showGrid && <Background color="#34312b" gap={props.preferences.canvas.gridSize * 2} variant={BackgroundVariant.Dots} />}
        {props.preferences.canvas.showControls && <Controls position="bottom-left" showInteractive={false} />}
      </ReactFlow>
      <CanvasToolbar props={props} />
    </main>
  );
}
