import '@xyflow/react/dist/style.css';
import {
  Controls,
  PanOnScrollMode,
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
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import './world-canvas.css';
import {
  applyCanvasPlacementCommand,
  readRememberedViewport,
  rememberInitialNodePlacements,
  rememberNodePlacements,
  rememberViewport,
  restoreNodePlacements,
} from './canvas-memory';
import {
  placementsFromNodes,
  type CanvasDragGrid,
  type CanvasPlacementCommand,
  type CanvasPlacementCommandOutcome,
  type CanvasPlacementChange,
  type WorldPoint,
} from './canvas-placement';
import {
  resolveWorldCanvasInteraction,
  type CanvasNodeDragAxis,
  type CanvasScrollPanDirection,
  type WorldCanvasInteraction,
} from './canvas-interaction';
import type { CanvasRuntime } from './canvas-runtime';
import { CanvasRuntimeProvider } from './CanvasRuntimeProvider';
import { createReactFlowCanvasAdapter } from './react-flow-canvas-adapter';
import { executeWorldCameraCommand } from './world-camera-runtime';
import type {
  CanvasCameraRequest,
  WorldCameraCommand,
  WorldCameraOutcome,
  WorldViewport,
} from './world-camera';
import { cameraRequestToCommand } from './world-camera';

export type {
  CanvasDragGrid,
  CanvasNodePlacement,
  CanvasPlacementCommand,
  CanvasPlacementCommandOutcome,
  CanvasPlacementChange,
  WorldPoint,
} from './canvas-placement';
export type { CanvasCameraRequest } from './world-camera';

/** The stable canvas surface available to disposable spatial Room designs. */
export interface WorldCanvasProps<NodeType extends Node = Node, EdgeType extends Edge = Edge> {
  viewportKey: string;
  nodes: readonly NodeType[];
  edges: readonly EdgeType[];
  nodeTypes: NodeTypes;
  edgeTypes?: EdgeTypes;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  resolveSelectionId?: (node: NodeType) => string | null;
  isNodeSelected?: (node: NodeType, selectedId: string | null) => boolean;
  onZoomChange?: (zoom: number) => void;
  onViewportChange?: (viewport: WorldViewport) => void;
  dragGrid?: CanvasDragGrid;
  onPaneDoubleClick?: (position: WorldPoint) => void;
  onPlacementChange?: (change: CanvasPlacementChange) => void;
  placementCommand?: CanvasPlacementCommand | null;
  onPlacementCommandOutcome?: (outcome: CanvasPlacementCommandOutcome) => void;
  resolveNodeChanges?: (
    changes: NodeChange<NodeType>[],
    currentNodes: readonly NodeType[],
  ) => NodeType[];
  onNodesChanged?: (nodes: readonly NodeType[]) => void;
  cameraCommand?: WorldCameraCommand | null;
  /** @deprecated Prefer cameraCommand. Kept so the current Mission prototype stays untouched. */
  cameraRequest?: CanvasCameraRequest | null;
  interaction?: WorldCanvasInteraction;
  canvasChildren?: ReactNode;
  screenChildren?: ReactNode;
  showControls?: boolean;
  surfaceClassName?: string;
  initialViewport?: WorldViewport;
  fitViewOnMount?: boolean;
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

function reactFlowScrollMode(direction: CanvasScrollPanDirection): PanOnScrollMode {
  if (direction === 'horizontal') return PanOnScrollMode.Horizontal;
  if (direction === 'vertical') return PanOnScrollMode.Vertical;
  return PanOnScrollMode.Free;
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
  resolveSelectionId,
  isNodeSelected,
  onZoomChange,
  onViewportChange,
  dragGrid,
  onPaneDoubleClick,
  onPlacementChange,
  placementCommand,
  onPlacementCommandOutcome,
  resolveNodeChanges,
  onNodesChanged,
  cameraCommand,
  cameraRequest,
  interaction,
  canvasChildren,
  screenChildren,
  showControls = true,
  surfaceClassName,
  initialViewport,
  fitViewOnMount,
}: WorldCanvasProps<NodeType, EdgeType> & {
  canvasElementRef: RefObject<HTMLDivElement | null>;
}) {
  const rememberedViewport = readRememberedViewport(viewportKey);
  const resolvedInteraction = resolveWorldCanvasInteraction(interaction);
  const [viewport, setCurrentViewport] = useState<Viewport>(
    rememberedViewport ?? initialViewport ?? { x: 0, y: 0, zoom: 1 },
  );
  const initialNodesRef = useRef<NodeType[] | null>(null);
  if (!initialNodesRef.current) {
    initialNodesRef.current = restoreNodePlacements(viewportKey, incomingNodes);
  }
  const [nodes, setNodes, applyNodeChanges] = useNodesState<NodeType>(initialNodesRef.current);
  const emittedRestoreRef = useRef(false);
  const emittedInitialViewportRef = useRef(false);
  const executedPlacementCommandKeysRef = useRef(new Set<string>());
  const placementCommandEmissionRef = useRef(false);
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
    if (!placementCommand || executedPlacementCommandKeysRef.current.has(placementCommand.key)) return;
    executedPlacementCommandKeysRef.current.add(placementCommand.key);

    const replacementTargets = new Set(placementCommand.mutations
      .filter((mutation) => mutation.type === 'replace-node-identity')
      .map((mutation) => mutation.toNodeId));
    rememberInitialNodePlacements(
      viewportKey,
      incomingNodes.filter((node) => !replacementTargets.has(node.id)),
    );
    const outcome = applyCanvasPlacementCommand(viewportKey, placementCommand);
    if (outcome.status === 'applied') placementCommandEmissionRef.current = true;
    onPlacementCommandOutcome?.(outcome);
  }, [incomingNodes, onPlacementCommandOutcome, placementCommand, viewportKey]);

  useEffect(() => {
    const restoredNodes = resolvedInteraction.rememberNodePositions
      ? restoreNodePlacements(viewportKey, incomingNodes)
      : [...incomingNodes];

    setNodes(restoredNodes.map((node) => ({
      ...node,
      selected: isNodeSelected
        ? isNodeSelected(node, selectedId)
        : node.id === selectedId,
    })));

    if (!emittedRestoreRef.current || placementCommandEmissionRef.current) {
      emittedRestoreRef.current = true;
      placementCommandEmissionRef.current = false;
      onPlacementChange?.({
        cause: 'restore',
        movedNodeId: null,
        placements: placementsFromNodes(restoredNodes),
      });
    }
  }, [
    incomingNodes,
    isNodeSelected,
    resolvedInteraction.rememberNodePositions,
    onPlacementChange,
    selectedId,
    setNodes,
    viewportKey,
  ]);

  useEffect(() => {
    if (emittedInitialViewportRef.current) return;
    emittedInitialViewportRef.current = true;
    onZoomChange?.(viewport.zoom);
    onViewportChange?.(viewport);
  }, [onViewportChange, onZoomChange, viewport]);

  useEffect(() => {
    const command = cameraCommand ?? cameraRequestToCommand(cameraRequest);
    if (!command) return;
    return scheduleCameraCommand(command, executeCameraCommand);
  }, [cameraCommand, cameraRequest, executeCameraCommand, nodes.length]);

  const handleNodeChanges = useCallback((changes: NodeChange<NodeType>[]) => {
    const constrainedChanges = constrainNodeMovement(
      changes,
      nodes,
      resolvedInteraction.nodeDragAxis,
    );

    if (!resolveNodeChanges) {
      applyNodeChanges(constrainedChanges);
      return;
    }

    const nextNodes = resolveNodeChanges(constrainedChanges, nodes);
    setNodes(nextNodes);
    onNodesChanged?.(nextNodes);
  }, [
    applyNodeChanges,
    nodes,
    onNodesChanged,
    resolveNodeChanges,
    resolvedInteraction.nodeDragAxis,
    setNodes,
  ]);

  const handleNodeDragStop: OnNodeDrag<NodeType> = useCallback((_, node) => {
    const settledNodes = nodes.map((candidate) => (
      candidate.id === node.id
        ? { ...candidate, position: { ...node.position } }
        : candidate
    ));
    const settledPlacements = placementsFromNodes(settledNodes);
    if (resolvedInteraction.rememberNodePositions) {
      rememberNodePlacements(viewportKey, settledPlacements);
    }
    onPlacementChange?.({
      cause: 'drag-end',
      movedNodeId: node.id,
      placements: settledPlacements,
    });
  }, [nodes, onPlacementChange, resolvedInteraction.rememberNodePositions, viewportKey]);

  const handlePaneDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onPaneDoubleClick || !(event.target instanceof Element)) return;
    if (!event.target.classList.contains('react-flow__pane')) return;
    onPaneDoubleClick(reactFlow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    }));
  }, [onPaneDoubleClick, reactFlow]);

  const handleMove: OnMove = useCallback((_, nextViewport) => {
    setCurrentViewport(nextViewport);
    onZoomChange?.(nextViewport.zoom);
    onViewportChange?.(nextViewport);
  }, [onViewportChange, onZoomChange]);

  const handleMoveEnd: OnMove = useCallback((_, nextViewport) => {
    if (resolvedInteraction.rememberViewport) {
      rememberViewport(viewportKey, nextViewport);
    }
  }, [resolvedInteraction.rememberViewport, viewportKey]);

  return (
    <CanvasRuntimeProvider runtime={runtime}>
      <div className="world-canvas__event-surface" onDoubleClick={handlePaneDoubleClick}>
        <ReactFlow<NodeType, EdgeType>
        className={['world-canvas__surface', surfaceClassName].filter(Boolean).join(' ')}
        nodes={nodes}
        edges={[...edges]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodeChanges}
        onNodeClick={(_, node) => onSelect(
          resolveSelectionId ? resolveSelectionId(node) : node.id,
        )}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={() => onSelect(null)}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        defaultViewport={rememberedViewport ?? initialViewport}
        fitView={fitViewOnMount ?? (!rememberedViewport && !initialViewport)}
        fitViewOptions={{ padding: 0.15, minZoom: 0.42, maxZoom: 0.9 }}
        minZoom={resolvedInteraction.minZoom}
        maxZoom={resolvedInteraction.maxZoom}
        nodesDraggable={resolvedInteraction.nodesDraggable}
        elementsSelectable={resolvedInteraction.elementsSelectable}
        selectionOnDrag={resolvedInteraction.selectionOnDrag}
        panOnDrag={resolvedInteraction.panOnDrag}
        panOnScroll={resolvedInteraction.panOnScroll}
        panOnScrollMode={reactFlowScrollMode(resolvedInteraction.panOnScrollDirection)}
        zoomOnScroll={resolvedInteraction.zoomOnScroll}
        zoomOnPinch={resolvedInteraction.zoomOnPinch}
        zoomOnDoubleClick={resolvedInteraction.zoomOnDoubleClick}
        snapToGrid={Boolean(dragGrid)}
        snapGrid={dragGrid ? [dragGrid.xStep, dragGrid.yStep] : undefined}
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
      </div>
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
