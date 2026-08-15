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
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnMove,
  type OnNodeDrag,
  type Viewport,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import './world-canvas.css';
import {
  readRememberedViewport,
  rememberNodePosition,
  rememberViewport,
  restoreNodePositions,
} from './canvas-memory';
import {
  resolveWorldCanvasInteraction,
  type CanvasNodeDragAxis,
  type WorldCanvasInteraction,
} from './canvas-interaction';
import type { CanvasRuntime } from './canvas-runtime';
import { CanvasRuntimeProvider } from './CanvasRuntimeProvider';
import { createReactFlowCanvasAdapter } from './react-flow-canvas-adapter';
import { executeWorldCameraCommand } from './world-camera-runtime';
import type {
  WorldCameraCommand,
  WorldCameraOutcome,
  WorldCameraPadding,
} from './world-camera';

/** Compatibility request retained while the current Mission World moves to camera commands. */
export type CanvasCameraRequest = {
  key: string;
  nodeIds: readonly string[];
  padding?: WorldCameraPadding;
  viewportInsets?: WorldCameraPadding;
  maxZoom?: number;
  duration?: number;
};

/** The stable canvas surface available to disposable spatial Room designs. */
export interface WorldCanvasProps<NodeType extends Node = Node, EdgeType extends Edge = Edge> {
  viewportKey: string;
  nodes: readonly NodeType[];
  edges: readonly EdgeType[];
  nodeTypes: NodeTypes;
  edgeTypes?: EdgeTypes;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onZoomChange?: (zoom: number) => void;
  cameraCommand?: WorldCameraCommand | null;
  /** @deprecated Prefer cameraCommand. Kept so the current Mission prototype stays untouched. */
  cameraRequest?: CanvasCameraRequest | null;
  interaction?: WorldCanvasInteraction;
  canvasChildren?: ReactNode;
  screenChildren?: ReactNode;
  showControls?: boolean;
}

function cameraRequestToCommand(
  request: CanvasCameraRequest | null | undefined,
): WorldCameraCommand | null {
  if (!request) return null;

  return {
    type: 'frame-nodes',
    key: request.key,
    nodeIds: request.nodeIds,
    padding: request.viewportInsets ?? request.padding,
    maxZoom: request.maxZoom,
    duration: request.duration,
  };
}

function constrainNodeMovement<NodeType extends Node>(
  changes: NodeChange<NodeType>[],
  nodes: readonly NodeType[],
  axis: CanvasNodeDragAxis,
): NodeChange<NodeType>[] {
  if (axis === 'both') return changes;

  const positionByNodeId = new Map(
    nodes.map((node) => [node.id, node.position]),
  );

  return changes.map((change) => {
    if (change.type !== 'position' || !change.position) return change;

    const currentPosition = positionByNodeId.get(change.id);
    if (!currentPosition) return change;

    return {
      ...change,
      position: {
        x: axis === 'vertical' ? currentPosition.x : change.position.x,
        y: axis === 'horizontal' ? currentPosition.y : change.position.y,
      },
    };
  });
}

function scheduleCameraCommand(
  command: WorldCameraCommand,
  execute: (commandToExecute: WorldCameraCommand) => Promise<WorldCameraOutcome>,
): () => void {
  let secondFrame = 0;
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(() => {
      void execute(command);
    });
  });

  return () => {
    cancelAnimationFrame(firstFrame);
    cancelAnimationFrame(secondFrame);
  };
}

function WorldCanvasSurface<NodeType extends Node, EdgeType extends Edge>({
  canvasElementRef,
  viewportKey,
  nodes: incomingNodes,
  edges,
  nodeTypes,
  edgeTypes,
  selectedId,
  onSelect,
  onZoomChange,
  cameraCommand,
  cameraRequest,
  interaction,
  canvasChildren,
  screenChildren,
  showControls = true,
}: WorldCanvasProps<NodeType, EdgeType> & {
  canvasElementRef: RefObject<HTMLDivElement | null>;
}) {
  const rememberedViewport = readRememberedViewport(viewportKey);
  const resolvedInteraction = resolveWorldCanvasInteraction(interaction);
  const [viewport, setCurrentViewport] = useState<Viewport>(
    rememberedViewport ?? { x: 0, y: 0, zoom: 1 },
  );
  const [nodes, setNodes, applyNodeChanges] = useNodesState<NodeType>(
    restoreNodePositions(viewportKey, incomingNodes),
  );
  const reactFlow = useReactFlow<NodeType, EdgeType>();

  const reactFlowAdapter = useMemo(
    () => createReactFlowCanvasAdapter({
      reactFlow,
      getCanvasElement: () => canvasElementRef.current,
    }),
    [canvasElementRef, reactFlow],
  );

  const executeCameraCommand = useCallback(
    (command: WorldCameraCommand) => executeWorldCameraCommand(
      command,
      reactFlowAdapter.cameraRuntime,
    ),
    [reactFlowAdapter],
  );

  const runtime: CanvasRuntime = {
    viewport,
    executeCameraCommand,
    getNodeScreenBounds: reactFlowAdapter.getNodeScreenBounds,
  };

  useEffect(() => {
    const restoredNodes = resolvedInteraction.rememberNodePositions
      ? restoreNodePositions(viewportKey, incomingNodes)
      : [...incomingNodes];

    setNodes(restoredNodes.map((node) => ({
      ...node,
      selected: node.id === selectedId,
    })));
  }, [
    incomingNodes,
    resolvedInteraction.rememberNodePositions,
    selectedId,
    setNodes,
    viewportKey,
  ]);

  useEffect(() => {
    const command = cameraCommand ?? cameraRequestToCommand(cameraRequest);
    if (!command) return;
    return scheduleCameraCommand(command, executeCameraCommand);
  }, [cameraCommand, cameraRequest, executeCameraCommand, nodes.length]);

  const handleNodeChanges = useCallback((changes: NodeChange<NodeType>[]) => {
    applyNodeChanges(constrainNodeMovement(
      changes,
      nodes,
      resolvedInteraction.nodeDragAxis,
    ));
  }, [applyNodeChanges, nodes, resolvedInteraction.nodeDragAxis]);

  const handleNodeDragStop: OnNodeDrag<NodeType> = useCallback((_, node) => {
    if (resolvedInteraction.rememberNodePositions) {
      rememberNodePosition(viewportKey, node.id, node.position);
    }
  }, [resolvedInteraction.rememberNodePositions, viewportKey]);

  const handleMove: OnMove = useCallback((_, nextViewport) => {
    setCurrentViewport(nextViewport);
    onZoomChange?.(nextViewport.zoom);
  }, [onZoomChange]);

  const handleMoveEnd: OnMove = useCallback((_, nextViewport) => {
    if (resolvedInteraction.rememberViewport) {
      rememberViewport(viewportKey, nextViewport);
    }
  }, [resolvedInteraction.rememberViewport, viewportKey]);

  return (
    <CanvasRuntimeProvider runtime={runtime}>
      <ReactFlow<NodeType, EdgeType>
        className="world-canvas__surface"
        nodes={nodes}
        edges={[...edges]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodeChanges}
        onNodeClick={(_, node) => onSelect(node.id)}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={() => onSelect(null)}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        defaultViewport={rememberedViewport}
        fitView={!rememberedViewport}
        fitViewOptions={{ padding: 0.15, minZoom: 0.42, maxZoom: 0.9 }}
        minZoom={resolvedInteraction.minZoom}
        maxZoom={resolvedInteraction.maxZoom}
        nodesDraggable={resolvedInteraction.nodesDraggable}
        elementsSelectable={resolvedInteraction.elementsSelectable}
        selectionOnDrag={resolvedInteraction.selectionOnDrag}
        panOnDrag={resolvedInteraction.panOnDrag}
        panOnScroll={resolvedInteraction.panOnScroll}
        zoomOnScroll={resolvedInteraction.zoomOnScroll}
        zoomOnPinch={resolvedInteraction.zoomOnPinch}
        zoomOnDoubleClick={resolvedInteraction.zoomOnDoubleClick}
        translateExtent={resolvedInteraction.translateExtent}
        nodeExtent={resolvedInteraction.nodeExtent}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        {canvasChildren && <ViewportPortal>{canvasChildren}</ViewportPortal>}
        {showControls && <Controls position="bottom-left" showInteractive={false} />}
      </ReactFlow>
      {screenChildren}
    </CanvasRuntimeProvider>
  );
}

/**
 * Interaction shell for spatial prototype rooms.
 *
 * It owns React Flow, camera execution and memory. Designs retain their layout,
 * node rendering, edges, semantic zoom policy, overlays and Room actions.
 */
export function WorldCanvas<NodeType extends Node, EdgeType extends Edge = Edge>(
  props: WorldCanvasProps<NodeType, EdgeType>,
) {
  const canvasElementRef = useRef<HTMLDivElement>(null);

  return (
    <div className="world-canvas" ref={canvasElementRef}>
      <ReactFlowProvider>
        <WorldCanvasSurface
          key={props.viewportKey}
          {...props}
          canvasElementRef={canvasElementRef}
        />
      </ReactFlowProvider>
    </div>
  );
}
