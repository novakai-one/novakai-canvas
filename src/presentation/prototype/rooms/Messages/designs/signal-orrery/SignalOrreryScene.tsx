import {
  applyNodeChanges,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { WorldCanvas } from '../../../../components/canvas/WorldCanvas';
import type { WorldCanvasInteraction } from '../../../../components/canvas/canvas-interaction';
import type { WorldCameraCommand, WorldViewport } from '../../../../components/canvas/world-camera';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { ObjectGraph } from '../../../../object-graph/graph';
import {
  buildSignalOrreryProjection,
  type OrreryEdge,
  type OrreryNode,
  type OrreryZoomTier,
} from './signal-orrery-geometry';
import type { SignalOrreryModel } from './signal-orrery-model';
import { SignalOrreryEdge } from './SignalOrreryEdges';
import { SignalOrreryNode } from './SignalOrreryNodes';

const nodeTypes = { orreryNode: SignalOrreryNode } satisfies NodeTypes;
const edgeTypes = { orreryEdge: SignalOrreryEdge } satisfies EdgeTypes;
const initialViewport: WorldViewport = { x: 0, y: 0, zoom: 0.72 };
const interaction = {
  nodesDraggable: true,
  elementsSelectable: true,
  panOnDrag: true,
  panOnScroll: false,
  zoomOnScroll: true,
  zoomOnPinch: true,
  minZoom: 0.55,
  maxZoom: 1.45,
  rememberNodePositions: false,
  rememberViewport: false,
} satisfies WorldCanvasInteraction;

type SignalOrrerySceneProps = {
  model: SignalOrreryModel;
  graph: ObjectGraph;
  activeThreadId: string | null;
  selected: ObjectRecord | null;
  overview: boolean;
  onChooseThread: (threadId: string) => void;
  onSelectRecord: (record: ObjectRecord | null) => void;
};

function zoomTier(zoom: number): OrreryZoomTier {
  if (zoom < 0.72) return 'far';
  if (zoom > 1.06) return 'near';
  return 'mid';
}

function focusCameraCommand(activeThreadId: string | null): WorldCameraCommand | null {
  if (!activeThreadId) return null;
  return {
    type: 'focus-node-at-anchor',
    key: `signal-orrery:focus:${activeThreadId}`,
    nodeId: activeThreadId,
    anchor: { horizontalRatio: 0.38, verticalRatio: 0.47 },
    zoom: 0.9,
    duration: 320,
  };
}

function overviewCameraCommand(overviewNodeIds: readonly string[]): WorldCameraCommand | null {
  if (overviewNodeIds.length === 0) return null;
  return {
    type: 'frame-nodes',
    key: `signal-orrery:overview:${overviewNodeIds.join(':')}`,
    nodeIds: overviewNodeIds,
    padding: 0.16,
    minZoom: 0.42,
    maxZoom: 0.68,
    duration: 420,
  };
}

function rememberConversationPositions(
  positions: Map<string, { x: number; y: number }>,
  nodes: readonly OrreryNode[],
): void {
  nodes
    .filter((node) => node.data.variant === 'conversation' && !node.data.focused)
    .forEach((node) => positions.set(node.id, node.position));
}

function SignalOrreryCanvas({
  projection,
  selected,
  command,
  movedPositions,
  onSelect,
  onZoom,
}: {
  projection: ReturnType<typeof buildSignalOrreryProjection>;
  selected: ObjectRecord | null;
  command: WorldCameraCommand | null;
  movedPositions: Map<string, { x: number; y: number }>;
  onSelect: (id: string | null) => void;
  onZoom: (viewport: WorldViewport) => void;
}) {
  const applyChanges = useCallback((changes: NodeChange<OrreryNode>[], nodes: readonly OrreryNode[]) => (
    applyNodeChanges(changes, [...nodes])
  ), []);
  return <WorldCanvas<OrreryNode, OrreryEdge>
    viewportKey="messages:signal-orrery"
    nodes={projection.nodes}
    edges={projection.edges}
    nodeTypes={nodeTypes}
    edgeTypes={edgeTypes}
    selectedId={selected?.id ?? null}
    resolveSelectionId={(node) => node.data.record.id}
    isNodeSelected={(node, selectedId) => node.data.record.id === selectedId}
    onSelect={onSelect}
    onViewportChange={onZoom}
    resolveNodeChanges={applyChanges}
    onNodesChanged={(nodes) => rememberConversationPositions(movedPositions, nodes)}
    cameraCommand={command}
    interaction={interaction}
    initialViewport={initialViewport}
    fitViewOnMount={false}
    surfaceClassName="signal-orrery__flow"
  />;
}

/** Owns Signal Orrery's React Flow projection, camera, zoom tiers and local drag state. */
export function SignalOrreryScene(props: SignalOrrerySceneProps) {
  const { model, graph, activeThreadId, selected, overview, onChooseThread, onSelectRecord } = props;
  const movedPositions = useRef(new Map<string, { x: number; y: number }>()).current;
  const [tier, setTier] = useState<OrreryZoomTier>('mid');
  const overviewIdentity = model.conversations.map((conversation) => conversation.record.id).join('|');
  const overviewNodeIds = useMemo(
    () => overviewIdentity.split('|').filter(Boolean),
    [overviewIdentity],
  );
  const projection = useMemo(() => buildSignalOrreryProjection(model, {
    activeThreadId,
    selectedId: selected?.id ?? null,
    overview,
    tier,
    movedPositions,
  }), [activeThreadId, model, movedPositions, overview, selected?.id, tier]);
  const focusedCommand = useMemo(
    () => overview ? null : focusCameraCommand(activeThreadId),
    [activeThreadId, overview],
  );
  const framedCommand = useMemo(
    () => overview ? overviewCameraCommand(overviewNodeIds) : null,
    [overview, overviewNodeIds],
  );
  const command = overview ? framedCommand : focusedCommand;
  const selectObject = (id: string | null) => {
    if (!id) return onSelectRecord(null);
    const record = graph.get(id);
    if (!record) return;
    if (record.kind === 'thread') onChooseThread(record.id);
    else onSelectRecord(record);
  };
  const updateZoom = (viewport: WorldViewport) => setTier((current) => {
    const next = zoomTier(viewport.zoom);
    return current === next ? current : next;
  });

  return <SignalOrreryCanvas
    projection={projection}
    selected={selected}
    command={command}
    movedPositions={movedPositions}
    onSelect={selectObject}
    onZoom={updateZoom}
  />;
}
