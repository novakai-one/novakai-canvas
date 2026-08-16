/**
 * Standing Wave's canvas policy: what the camera does, and what the user may move.
 *
 * Nodes are not draggable, because a node's horizontal position *is* its timestamp and
 * dragging one would falsify the clock. Scrolling pans horizontally, which is the design's
 * one gesture: you scroll through time. The camera moves on entry and when a conversation
 * is opened, and never on selection — selecting a moment opens the reader without moving
 * the user.
 */
import { type NodeTypes } from '@xyflow/react';
import { useMemo, useRef, useState } from 'react';
import { WorldCanvas } from '../../../../components/canvas/WorldCanvas';
import type { WorldCameraCommand, WorldViewport } from '../../../../components/canvas/world-camera';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignCommands } from '../../messages-design';
import type { WaveClock } from './standing-wave-clock';
import type { StandingWaveModel, WaveAgent, WaveTrace } from './standing-wave-model';
import { projectStandingWave, type WaveNodeType, type WaveTier } from './standing-wave-projection';
import { WaveBeadNode } from './WaveBeadNode';
import { WaveGround } from './WaveGround';
import { WaveScreenLayer } from './WaveScreenLayer';
import { WaveTraceNode } from './WaveTraceNode';

const nodeTypes = { waveTrace: WaveTraceNode, waveBead: WaveBeadNode } satisfies NodeTypes;
const initialViewport: WorldViewport = { x: 260, y: 96, zoom: 0.82 };
const READ_TIER_ZOOM_IN = 0.76;
const READ_TIER_ZOOM_OUT = 0.66;

function tierForZoom(zoom: number, currentTier: WaveTier): WaveTier {
  if (currentTier === 'near' && zoom < READ_TIER_ZOOM_OUT) return 'far';
  if (currentTier === 'far' && zoom > READ_TIER_ZOOM_IN) return 'near';
  return currentTier;
}

/**
 * The camera always lands on the open conversation, on entry and on every switch.
 *
 * Framing all eighteen lanes at once produced a wall of equal rows with no subject.
 * Anchoring the newest moment of the open conversation instead makes the Room arrive with
 * something to read, and the surrounding lanes stay visible above and below as context.
 */
function openTraceCameraCommand(threadId: string, focusNodeId: string): WorldCameraCommand {
  return {
    type: 'focus-node-at-anchor',
    key: `standing-wave:open:${threadId}`,
    nodeId: focusNodeId,
    anchor: { horizontalRatio: 0.62, verticalRatio: 0.46 },
    zoom: 0.94,
    duration: 520,
  };
}

/** Owns the projection, the zoom tier and the camera for one active conversation. */
export function StandingWaveCanvas({
  model,
  clock,
  graph,
  activeTrace,
  selected,
  selectedNodeId,
  commands,
  onChooseThread,
  onChooseAgent,
  onSelectNode,
  onCloseInspector,
}: {
  model: StandingWaveModel;
  clock: WaveClock;
  graph: ObjectGraph;
  activeTrace: WaveTrace | null;
  selected: ObjectRecord | null;
  selectedNodeId: string | null;
  commands: MessagesDesignCommands;
  onChooseThread: (threadId: string) => void;
  onChooseAgent: (agent: WaveAgent) => void;
  onSelectNode: (record: ObjectRecord, nodeId: string) => void;
  onCloseInspector: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<WaveTier>('near');
  const activeThreadId = activeTrace?.record.id ?? '';

  const projection = useMemo(
    () => projectStandingWave(model, clock, activeThreadId, tier),
    [activeThreadId, clock, model, tier],
  );

  const cameraCommand = useMemo(
    () => (projection.focusNodeId
      ? openTraceCameraCommand(activeThreadId, projection.focusNodeId)
      : null),
    [activeThreadId, projection.focusNodeId],
  );

  const selectNode = (nodeId: string | null) => {
    if (!nodeId) return onCloseInspector();
    const node = projection.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    if (node.type === 'waveTrace') return onChooseThread(node.data.lane.threadId);
    onSelectNode(node.data.record, node.id);
  };

  return (
    <div className="standing-wave__canvas" ref={hostRef} data-tier={tier}>
      <WorldCanvas<WaveNodeType>
        viewportKey="messages:standing-wave"
        nodes={projection.nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        selectedId={selected?.id ?? null}
        isNodeSelected={(node) => node.id === selectedNodeId}
        onSelect={selectNode}
        onZoomChange={(zoom) => setTier((current) => tierForZoom(zoom, current))}
        cameraCommand={cameraCommand}
        interaction={{
          nodesDraggable: false,
          elementsSelectable: true,
          panOnDrag: true,
          panOnScroll: true,
          panOnScrollDirection: 'horizontal',
          zoomOnScroll: false,
          zoomOnPinch: true,
          minZoom: 0.5,
          maxZoom: 1.4,
          rememberNodePositions: false,
          rememberViewport: false,
        }}
        initialViewport={initialViewport}
        fitViewOnMount={false}
        surfaceClassName="standing-wave__flow"
        canvasChildren={
          <WaveGround clock={clock} contentHeight={projection.contentHeight} />
        }
        screenChildren={
          <WaveScreenLayer
            hostRef={hostRef}
            graph={graph}
            model={model}
            lanes={projection.lanes}
            activeTrace={activeTrace}
            selected={selected}
            selectedNodeId={selectedNodeId}
            commands={commands}
            onChooseThread={onChooseThread}
            onChooseAgent={onChooseAgent}
            onCloseInspector={onCloseInspector}
          />
        }
      />
    </div>
  );
}
