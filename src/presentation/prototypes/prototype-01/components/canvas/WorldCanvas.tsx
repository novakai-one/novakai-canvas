import '@xyflow/react/dist/style.css';
import {
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type Edge,
  type Node,
  type NodeTypes,
  type Viewport,
} from '@xyflow/react';
import { useEffect } from 'react';
import './world-canvas.css';

const rememberedViewports = new Map<string, Viewport>();
const rememberedPositions = new Map<string, Map<string, Node['position']>>();

export interface WorldCanvasProps<NodeType extends Node = Node> {
  viewportKey: string;
  nodes: readonly NodeType[];
  edges: readonly Edge[];
  nodeTypes: NodeTypes;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpen?: (id: string) => void;
  showControls?: boolean;
}

function restorePositions<NodeType extends Node>(viewportKey: string, nodes: readonly NodeType[]): NodeType[] {
  const positions = rememberedPositions.get(viewportKey);
  if (!positions) return [...nodes];

  return nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? { ...node, position } : node;
  });
}

function WorldCanvasSurface<NodeType extends Node>({
  viewportKey,
  nodes: incomingNodes,
  edges,
  nodeTypes,
  selectedId,
  onSelect,
  onOpen,
  showControls = true,
}: WorldCanvasProps<NodeType>) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeType>(
    restorePositions(viewportKey, incomingNodes),
  );
  const rememberedViewport = rememberedViewports.get(viewportKey);

  useEffect(() => {
    setNodes(
      restorePositions(viewportKey, incomingNodes).map((node) => ({
        ...node,
        selected: node.id === selectedId,
      })),
    );
  }, [incomingNodes, selectedId, setNodes, viewportKey]);

  return (
    <ReactFlow<NodeType, Edge>
      className="world-canvas__surface"
      nodes={nodes}
      edges={[...edges]}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => onSelect(node.id)}
      onNodeDoubleClick={(_, node) => onOpen?.(node.id)}
      onNodeDragStop={(_, node) => {
        const positions = rememberedPositions.get(viewportKey) ?? new Map();
        positions.set(node.id, node.position);
        rememberedPositions.set(viewportKey, positions);
      }}
      onPaneClick={() => onSelect(null)}
      onMoveEnd={(_, viewport) => rememberedViewports.set(viewportKey, viewport)}
      defaultViewport={rememberedViewport}
      fitView={!rememberedViewport}
      fitViewOptions={{ padding: 0.22, minZoom: 0.45, maxZoom: 1 }}
      minZoom={0.2}
      maxZoom={2.5}
      nodesConnectable={false}
      edgesFocusable={false}
      deleteKeyCode={null}
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
    >
      {showControls && <Controls position="bottom-left" showInteractive={false} />}
    </ReactFlow>
  );
}

/**
 * Interaction shell for spatial prototype rooms.
 *
 * It owns the canvas mechanics while callers keep ownership of node rendering,
 * graph-to-position mapping, edge styling, and room-specific actions.
 */
export function WorldCanvas<NodeType extends Node>(props: WorldCanvasProps<NodeType>) {
  return (
    <div className="world-canvas">
      <ReactFlowProvider>
        <WorldCanvasSurface {...props} />
      </ReactFlowProvider>
    </div>
  );
}
