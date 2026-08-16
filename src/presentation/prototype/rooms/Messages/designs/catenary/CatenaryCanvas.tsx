import type { EdgeTypes, NodeTypes } from '@xyflow/react';
import { useMemo, useRef, useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { ObjectGraph } from '../../../../object-graph/graph';
import { WorldCanvas } from '../../../../components/canvas/WorldCanvas';
import type {
  WorldCameraCommand,
  WorldViewport,
} from '../../../../components/canvas/world-camera';
import type { MessagesDesignCommands } from '../../messages-design';
import { BeadNode } from './BeadNode';
import { CableEdge } from './CableEdge';
import { HourFloor } from './HourFloor';
import { CatenaryScreenLayer } from './CatenaryScreenLayer';
import type { Cable, CatenaryModel } from './catenary-model';
import {
  AGENT_ANCHOR_PREFIX,
  YOU_ANCHOR_PREFIX,
  projectCatenary,
  type CableEdge as CableEdgeModel,
  type CableNode,
  type CatenaryTier,
} from './catenary-projection';

const nodeTypes = { cableBead: BeadNode } satisfies NodeTypes;
const edgeTypes = { cable: CableEdge } satisfies EdgeTypes;
/** Roughly where the camera lands anyway, so the first painted frame is never empty. */
const initialViewport: WorldViewport = { x: 520, y: 400, zoom: 0.86 };

const ENTER_READING_ZOOM = 0.72;
const LEAVE_READING_ZOOM = 0.64;

function tierForZoom(zoom: number, current: CatenaryTier): CatenaryTier {
  if (current === 'reading' && zoom < LEAVE_READING_ZOOM) return 'bundle';
  if (current === 'bundle' && zoom > ENTER_READING_ZOOM) return 'reading';
  return current;
}

/**
 * Where the reader lands.
 *
 * Arriving on a cable frames its name and its load together, so the hero is always
 * readable and the camera can never come to rest on empty canvas. Choosing a bead
 * afterwards moves to that turn, left of centre, with the cable running away right.
 */
function readingCamera(
  cableId: string,
  sourceNodeId: string | null,
  focusNodeId: string | null,
): WorldCameraCommand | null {
  if (sourceNodeId) {
    return {
      type: 'focus-node-at-anchor',
      key: `catenary:${cableId}:selected:${sourceNodeId}`,
      nodeId: sourceNodeId,
      anchor: { horizontalRatio: 0.32, verticalRatio: 0.4 },
      zoom: 1,
      duration: 460,
    };
  }

  const anchorNodeId = `${AGENT_ANCHOR_PREFIX}${cableId}`;
  return {
    type: 'frame-nodes',
    key: `catenary:${cableId}:entry`,
    nodeIds: focusNodeId ? [anchorNodeId, focusNodeId] : [anchorNodeId],
    padding: 0.22,
    minZoom: 0.72,
    maxZoom: 1,
    duration: 460,
  };
}

/** Pulls back just far enough to read the hero cable's whole span and its neighbours. */
function bundleCamera(cableId: string): WorldCameraCommand {
  return {
    type: 'frame-nodes',
    key: `catenary:${cableId}:bundle`,
    nodeIds: [`${AGENT_ANCHOR_PREFIX}${cableId}`, `${YOU_ANCHOR_PREFIX}${cableId}`],
    padding: 0.26,
    minZoom: 0.58,
    maxZoom: 0.7,
    duration: 420,
  };
}

/** Owns Catenary's canvas projection, semantic zoom and camera policy. */
export function CatenaryCanvas({
  model,
  graph,
  focusedCable,
  selected,
  sourceNodeId,
  releasedCableId,
  commands,
  onChooseCable,
  onSelectBead,
  onCloseInspector,
}: {
  model: CatenaryModel;
  graph: ObjectGraph;
  focusedCable: Cable;
  selected: ObjectRecord | null;
  sourceNodeId: string | null;
  releasedCableId: string | null;
  commands: MessagesDesignCommands;
  onChooseCable: (cableId: string) => void;
  onSelectBead: (record: ObjectRecord, nodeId: string) => void;
  onCloseInspector: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<CatenaryTier>('reading');
  const cableId = focusedCable.record.id;

  const projection = useMemo(
    () => projectCatenary(model, cableId, tier, releasedCableId),
    [cableId, model, releasedCableId, tier],
  );
  const camera = useMemo(
    () => (tier === 'reading'
      ? readingCamera(cableId, sourceNodeId, projection.focusNodeId)
      : bundleCamera(cableId)),
    [cableId, projection.focusNodeId, sourceNodeId, tier],
  );

  const selectNode = (nodeId: string | null) => {
    if (!nodeId) return onCloseInspector();
    const node = projection.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const { variant, cableId: chosenId, record } = node.data;
    if (variant === 'agentAnchor' || variant === 'tally') return onChooseCable(chosenId);
    if (variant === 'bead') onSelectBead(record, node.id);
  };

  const changeZoom = (zoom: number) => {
    const nextTier = tierForZoom(zoom, tier);
    if (nextTier === tier) return;
    if (nextTier === 'bundle') onCloseInspector();
    setTier(nextTier);
  };

  return (
    <div
      className="catenary-canvas"
      ref={hostRef}
      data-tier={tier}
      data-inspector={Boolean(selected)}
    >
      <WorldCanvas<CableNode, CableEdgeModel>
        viewportKey={`messages:catenary:${cableId}`}
        nodes={projection.nodes}
        edges={projection.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        selectedId={selected?.id ?? null}
        isNodeSelected={(node) => node.id === sourceNodeId}
        onSelect={selectNode}
        onZoomChange={changeZoom}
        cameraCommand={camera}
        interaction={{
          nodesDraggable: false,
          elementsSelectable: true,
          panOnDrag: true,
          panOnScroll: true,
          panOnScrollDirection: 'vertical',
          zoomOnScroll: false,
          zoomOnPinch: true,
          minZoom: 0.45,
          maxZoom: 1.2,
          rememberNodePositions: false,
          rememberViewport: false,
        }}
        initialViewport={initialViewport}
        fitViewOnMount={false}
        surfaceClassName="catenary-canvas__flow"
        canvasChildren={projection.floor && <HourFloor floor={projection.floor} />}
        screenChildren={selected ? (
          <CatenaryScreenLayer
            hostRef={hostRef}
            graph={graph}
            selected={selected}
            sourceNodeId={sourceNodeId}
            load={focusedCable.load?.sourceMessageId === selected.id ? focusedCable.load : null}
            commands={commands}
            onClose={onCloseInspector}
          />
        ) : null}
      />
    </div>
  );
}
