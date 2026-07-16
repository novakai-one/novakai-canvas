import { useMemo } from 'react';
import {
  Background, BackgroundVariant, Controls, ReactFlow, type Connection, type NodeChange,
} from '@xyflow/react';
import type { CanvasEngine } from '../../application/canvas-engine';
import type { ArchitectureDocument, CanvasPreferences, Selection } from '../../domain/model';
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

export function CanvasSurface(props: CanvasSurfaceProps) {
  const nodes = useMemo(
    () => projectNodes(props.document, props.preferences, props.selection, props.setSelection),
    [props.document, props.preferences, props.selection, props.setSelection],
  );
  const edges = useMemo(
    () => projectEdges(props.document, props.preferences, props.selection, props.setSelection),
    [props.document, props.preferences, props.selection, props.setSelection],
  );

  const addNode = (kind: 'module' | 'comment'): void => {
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const count = Object.keys(props.document.nodes).length;
    props.engine.execute({
      kind: 'node.add',
      node: {
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
      },
    });
    props.setSelection({ kind: 'node', id });
  };

  const onNodesChange = (changes: NodeChange[]): void => {
    changes.forEach((change) => {
      if (change.type === 'position' && change.position) {
        props.engine.execute({ kind: 'node.move', id: change.id, position: change.position });
      }
      if (change.type === 'remove') props.engine.execute({ kind: 'node.remove', id: change.id });
    });
  };

  const onConnect = (connection: Connection): void => {
    if (!connection.source || !connection.target) return;
    const id = `wire-${crypto.randomUUID().slice(0, 8)}`;
    props.engine.execute({
      kind: 'wire.add',
      wire: { id, source: connection.source, target: connection.target, label: 'connects', kind: 'references', routing: 'elbow' },
    });
    props.setSelection({ kind: 'wire', id });
  };

  return (
    <main className="canvas-surface">
      <ReactFlow
        colorMode="dark"
        deleteKeyCode={['Backspace', 'Delete']}
        edgeTypes={edgeTypes}
        edges={edges}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.35}
        nodeTypes={nodeTypes}
        nodes={nodes}
        nodesConnectable
        nodesDraggable
        onConnect={onConnect}
        onEdgeClick={(_event, edge) => props.setSelection({ kind: 'wire', id: edge.id })}
        onNodeClick={(_event, node) => props.setSelection({ kind: 'node', id: node.id })}
        onNodesChange={onNodesChange}
        onPaneClick={() => props.setSelection(null)}
        selectionOnDrag
        snapGrid={[props.preferences.canvas.gridSize, props.preferences.canvas.gridSize]}
        snapToGrid={props.preferences.canvas.snapToGrid}
      >
        {props.preferences.canvas.showGrid && (
          <Background color="#34312b" gap={props.preferences.canvas.gridSize * 2} variant={BackgroundVariant.Dots} />
        )}
        {props.preferences.canvas.showControls && <Controls position="bottom-left" showInteractive={false} />}
      </ReactFlow>
      <div className="canvas-toolbar">
        <div className="file-identity"><span>{props.document.name}</span><small>r{props.document.revision}</small></div>
        <div className="toolbar-actions">
          <button onClick={() => addNode('module')} type="button"><span>＋</span>Node</button>
          <button onClick={() => addNode('comment')} type="button"><span>＋</span>Comment</button>
        </div>
        <span className="save-status">{props.saveStatus}</span>
      </div>
    </main>
  );
}
