import '@xyflow/react/dist/style.css';
import {
  Controls,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeTypes,
  type FitViewOptions,
  type Node,
  type NodeTypes,
  type Viewport,
} from '@xyflow/react';
import { useEffect, type ReactNode } from 'react';
import './world-canvas.css';

const rememberedViewports = new Map<string, Viewport>();
const rememberedPositions = new Map<string, Map<string, Node['position']>>();

export type CanvasCameraRequest = {
  key: string;
  nodeIds: readonly string[];
  padding?: FitViewOptions['padding'];
  viewportInsets?: FitViewOptions['padding'];
  maxZoom?: number;
  duration?: number;
};

export interface WorldCanvasProps<NodeType extends Node = Node, EdgeType extends Edge = Edge> {
  viewportKey: string;
  nodes: readonly NodeType[];
  edges: readonly EdgeType[];
  nodeTypes: NodeTypes;
  edgeTypes?: EdgeTypes;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onZoomChange?: (zoom: number) => void;
  cameraRequest?: CanvasCameraRequest | null;
  canvasChildren?: ReactNode;
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

function WorldCanvasSurface<NodeType extends Node, EdgeType extends Edge>({
  viewportKey,
  nodes: incomingNodes,
  edges,
  nodeTypes,
  edgeTypes,
  selectedId,
  onSelect,
  onZoomChange,
  cameraRequest,
  canvasChildren,
  showControls = true,
}: WorldCanvasProps<NodeType, EdgeType>) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeType>(
    restorePositions(viewportKey, incomingNodes),
  );
  const { fitView } = useReactFlow<NodeType, EdgeType>();
  const rememberedViewport = rememberedViewports.get(viewportKey);

  useEffect(() => {
    setNodes(
      restorePositions(viewportKey, incomingNodes).map((node) => ({
        ...node,
        selected: node.id === selectedId,
      })),
    );
  }, [incomingNodes, selectedId, setNodes, viewportKey]);

  useEffect(() => {
    if (!cameraRequest || cameraRequest.nodeIds.length === 0) return;

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        void fitView({
          nodes: cameraRequest.nodeIds.map((id) => ({ id })),
          padding: cameraRequest.viewportInsets ?? cameraRequest.padding ?? 0.16,
          minZoom: 0.28,
          maxZoom: cameraRequest.maxZoom ?? 0.96,
          duration: reduceMotion ? 0 : (cameraRequest.duration ?? 480),
        });
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [cameraRequest, fitView, nodes.length]);

  return (
    <ReactFlow<NodeType, EdgeType>
      className="world-canvas__surface"
      nodes={nodes}
      edges={[...edges]}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => onSelect(node.id)}
      onNodeDragStop={(_, node) => {
        const positions = rememberedPositions.get(viewportKey) ?? new Map();
        positions.set(node.id, node.position);
        rememberedPositions.set(viewportKey, positions);
      }}
      onPaneClick={() => onSelect(null)}
      onMove={(_, viewport) => onZoomChange?.(viewport.zoom)}
      onMoveEnd={(_, viewport) => rememberedViewports.set(viewportKey, viewport)}
      defaultViewport={rememberedViewport}
      fitView={!rememberedViewport}
      fitViewOptions={{ padding: 0.15, minZoom: 0.42, maxZoom: 0.9 }}
      minZoom={0.2}
      maxZoom={2.5}
      nodesConnectable={false}
      edgesFocusable={false}
      deleteKeyCode={null}
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
    >
      {canvasChildren && <ViewportPortal>{canvasChildren}</ViewportPortal>}
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
export function WorldCanvas<NodeType extends Node, EdgeType extends Edge = Edge>(
  props: WorldCanvasProps<NodeType, EdgeType>,
) {
  return (
    <div className="world-canvas">
      <ReactFlowProvider>
        <WorldCanvasSurface {...props} />
      </ReactFlowProvider>
    </div>
  );
}
