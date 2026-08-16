import { type EdgeTypes, type NodeTypes } from '@xyflow/react';
import { useMemo, useRef, useState } from 'react';
import { WorldCanvas } from '../../../../components/canvas/WorldCanvas';
import type { WorldCameraCommand, WorldViewport } from '../../../../components/canvas/world-camera';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignCommands } from '../../messages-design';
import type { RelayRiverModel, RiverThread } from './relay-river-model';
import {
  projectRelayRiver,
  type RelayRiverTier,
  type RiverEdge,
  type RiverNode,
} from './relay-river-projection';
import { RiverCurrentEdge } from './RiverCurrentEdge';
import { RiverLandmarkNode } from './RiverLandmarkNode';
import { RiverScreenLayer } from './RiverScreenLayer';

const nodeTypes = { riverLandmark: RiverLandmarkNode } satisfies NodeTypes;
const edgeTypes = { riverCurrent: RiverCurrentEdge } satisfies EdgeTypes;
const initialViewport: WorldViewport = { x: 48, y: 64, zoom: 1 };

function tierForZoom(zoom: number, current: RelayRiverTier): RelayRiverTier {
  if (current === 'reading' && zoom < 0.66) return 'overview';
  if (current === 'overview' && zoom > 0.76) return 'reading';
  return current;
}

function cameraCommand(
  activeThreadId: string,
  sourceNodeId: string | null,
  focusNodeId: string | null,
): WorldCameraCommand | null {
  const nodeId = sourceNodeId ?? focusNodeId;
  if (!nodeId) return null;
  return {
    type: 'focus-node-at-anchor',
    key: `relay-river:${activeThreadId}:${sourceNodeId ? `selected:${sourceNodeId}` : 'entry'}`,
    nodeId,
    anchor: sourceNodeId
      ? { horizontalRatio: 0.35, verticalRatio: 0.42 }
      : { horizontalRatio: 0.46, verticalRatio: 0.62 },
    zoom: 1,
    duration: 460,
  };
}

function overviewCameraCommand(
  activeThreadId: string,
  focusNodeId: string | null,
): WorldCameraCommand {
  const headwaterNodeId = `river-headwater:${activeThreadId}`;
  return {
    type: 'frame-nodes',
    key: `relay-river:${activeThreadId}:overview`,
    nodeIds: focusNodeId && focusNodeId !== headwaterNodeId
      ? [headwaterNodeId, focusNodeId]
      : [headwaterNodeId],
    padding: 0.18,
    minZoom: 0.52,
    maxZoom: 0.62,
    duration: 360,
  };
}

/** Owns Relay River's canvas projection, semantic zoom and camera policy. */
export function RelayRiverCanvas({
  model,
  graph,
  activeThread,
  selected,
  sourceNodeId,
  commands,
  onChooseThread,
  onSelectSource,
  onCloseInspector,
}: {
  model: RelayRiverModel;
  graph: ObjectGraph;
  activeThread: RiverThread;
  selected: ObjectRecord | null;
  sourceNodeId: string | null;
  commands: MessagesDesignCommands;
  onChooseThread: (threadId: string) => void;
  onSelectSource: (record: ObjectRecord, sourceNodeId: string) => void;
  onCloseInspector: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<RelayRiverTier>('reading');
  const projection = useMemo(() => projectRelayRiver(
    model,
    activeThread.record.id,
    tier,
    { onInspectReference: onSelectSource, canOpen: commands.canOpen, open: commands.open },
  ), [activeThread.record.id, commands.canOpen, commands.open, model, onSelectSource, tier]);
  const command = useMemo(
    () => cameraCommand(activeThread.record.id, sourceNodeId, projection.focusNodeId),
    [activeThread.record.id, projection.focusNodeId, sourceNodeId],
  );
  const overviewCommand = useMemo(
    () => overviewCameraCommand(activeThread.record.id, projection.focusNodeId),
    [activeThread.record.id, projection.focusNodeId],
  );
  const activeCameraCommand = tier === 'reading' ? command : overviewCommand;

  const selectNode = (nodeId: string | null) => {
    if (!nodeId) return onCloseInspector();
    const node = projection.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    if (node.data.variant === 'tributary') return onChooseThread(node.data.record.id);
    onSelectSource(node.data.record, node.id);
  };

  return (
    <div className="relay-river-canvas" ref={hostRef} data-tier={tier} data-inspector={Boolean(selected)}>
      <WorldCanvas<RiverNode, RiverEdge>
        viewportKey={`messages:relay-river:${activeThread.record.id}`}
        nodes={projection.nodes}
        edges={projection.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        selectedId={selected?.id ?? null}
        isNodeSelected={(node) => node.id === sourceNodeId}
        onSelect={selectNode}
        onZoomChange={(zoom) => {
          const nextTier = tierForZoom(zoom, tier);
          if (nextTier === 'overview' && tier !== nextTier) onCloseInspector();
          setTier(nextTier);
        }}
        cameraCommand={activeCameraCommand}
        interaction={{
          nodesDraggable: false,
          elementsSelectable: true,
          panOnDrag: true,
          panOnScroll: true,
          panOnScrollDirection: 'vertical',
          zoomOnScroll: false,
          zoomOnPinch: true,
          minZoom: 0.48,
          maxZoom: 1.15,
          rememberNodePositions: false,
          rememberViewport: false,
        }}
        initialViewport={initialViewport}
        fitViewOnMount={false}
        surfaceClassName="relay-river-canvas__flow"
        screenChildren={selected ? (
          <RiverScreenLayer
            hostRef={hostRef}
            graph={graph}
            selected={selected}
            sourceNodeId={sourceNodeId}
            commands={commands}
            onClose={onCloseInspector}
          />
        ) : null}
      />
    </div>
  );
}
