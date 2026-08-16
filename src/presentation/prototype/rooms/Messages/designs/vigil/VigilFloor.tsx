import {
  applyNodeChanges,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react';
import { useCallback, useMemo, useState } from 'react';
import { WorldCanvas } from '../../../../components/canvas/WorldCanvas';
import type { WorldCameraCommand } from '../../../../components/canvas/world-camera';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { RING_FLATTENING } from './vigil-geometry';
import type { VigilModel } from './vigil-model';
import {
  HERO_NODE_ID,
  projectVigilFloor,
  type LanternFlowNode,
  type VigilFlowNode,
} from './vigil-projection';
import { VigilGround } from './VigilGround';
import { VigilHeroRing } from './VigilHeroRing';
import { VigilLanternNode } from './VigilLanternNode';
import { VigilMomentNode } from './VigilMomentNode';
import { VigilRayEdge } from './VigilRayEdge';

const nodeTypes = {
  vigilHero: VigilHeroRing,
  vigilLantern: VigilLanternNode,
  vigilMoment: VigilMomentNode,
} satisfies NodeTypes;

const edgeTypes = { vigilRay: VigilRayEdge } satisfies EdgeTypes;

/** The two detail levels the floor supports, with hysteresis so they never flicker. */
type VigilTier = 'floor' | 'vigil';

/** How far the lantern's own top-left sits above its seat on the ring. */
const LANTERN_SEAT_OFFSET_Y = 40;

/** Entry sits at 0.62, so the readable tier has to reach below it or the floor opens bare. */
function tierForZoom(zoom: number, current: VigilTier): VigilTier {
  if (current === 'vigil' && zoom < 0.52) return 'floor';
  if (current === 'floor' && zoom > 0.6) return 'vigil';
  return current;
}

/**
 * Entry frames you and the near rings; opening a conversation frames its whole ray.
 *
 * Selecting never produces a command — the inspector opens without moving the viewer.
 */
function cameraCommand(openedThreadId: string | null, rayNodeIds: readonly string[]): WorldCameraCommand {
  if (!openedThreadId) {
    return {
      type: 'focus-node-at-anchor',
      key: 'vigil:entry',
      nodeId: HERO_NODE_ID,
      anchor: { horizontalRatio: 0.42, verticalRatio: 0.5 },
      zoom: 0.62,
      duration: 520,
    };
  }

  return {
    type: 'frame-nodes',
    key: `vigil:open:${openedThreadId}`,
    nodeIds: rayNodeIds,
    padding: { top: '12%', right: '40%', bottom: '14%', left: '10%' },
    minZoom: 0.5,
    maxZoom: 0.95,
    duration: 520,
  };
}

/**
 * Puts a dragged lantern back on its own ring.
 *
 * Radius is data: it is how long this conversation has been silent. You may slide a
 * lantern around its ring to group the floor however you like, but nothing can move
 * one nearer or further, because that would make the picture lie.
 */
function seatOnOwnRing(node: LanternFlowNode): LanternFlowNode {
  const centreX = node.position.x + node.data.width / 2;
  const centreY = node.position.y + LANTERN_SEAT_OFFSET_Y;
  const angle = Math.atan2(centreY / RING_FLATTENING, centreX);
  const radiusX = node.data.bandRadiusX;

  return {
    ...node,
    position: {
      x: radiusX * Math.cos(angle) - node.data.width / 2,
      y: radiusX * RING_FLATTENING * Math.sin(angle) - LANTERN_SEAT_OFFSET_Y,
    },
  };
}

function isLantern(node: VigilFlowNode): node is LanternFlowNode {
  return node.type === 'vigilLantern';
}

/** Owns Vigil's canvas: projection, camera, detail tier and the ring drag rule. */
export function VigilFloor({
  model,
  openedThreadId,
  selectedRecordId,
  onOpen,
  onSelectRecord,
}: {
  model: VigilModel;
  openedThreadId: string | null;
  selectedRecordId: string | null;
  onOpen: (threadId: string) => void;
  onSelectRecord: (record: ObjectRecord | null) => void;
}) {
  const [tier, setTier] = useState<VigilTier>('vigil');
  const { nodes, edges, recordsByNodeId, camera } = useFloorProjection(model, openedThreadId, onOpen);

  const selectedNodeId = useMemo(() => {
    for (const [nodeId, record] of recordsByNodeId) {
      if (record.id === selectedRecordId) return nodeId;
    }
    return null;
  }, [recordsByNodeId, selectedRecordId]);

  const resolveNodeChanges = useCallback((
    changes: NodeChange<VigilFlowNode>[],
    currentNodes: readonly VigilFlowNode[],
  ) => applyNodeChanges(changes, [...currentNodes])
    .map((node) => (isLantern(node) ? seatOnOwnRing(node) : node)), []);

  return (
    <WorldCanvas<VigilFlowNode>
      viewportKey="messages-vigil"
      surfaceClassName={`vigil-surface vigil-surface--${tier}`}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      selectedId={selectedNodeId}
      onSelect={(id) => onSelectRecord(id ? recordsByNodeId.get(id) ?? null : null)}
      resolveSelectionId={(node) => node.id}
      isNodeSelected={(node, id) => node.id === id}
      onZoomChange={(zoom) => setTier((current) => tierForZoom(zoom, current))}
      resolveNodeChanges={resolveNodeChanges}
      cameraCommand={camera}
      interaction={{
        panOnDrag: true,
        zoomOnScroll: true,
        zoomOnDoubleClick: false,
        minZoom: 0.4,
        maxZoom: 1.4,
        selectionOnDrag: false,
        rememberNodePositions: false,
        rememberViewport: true,
      }}
      canvasChildren={<VigilGround />}
      initialViewport={{ x: 500, y: 450, zoom: 0.62 }}
    />
  );
}

/**
 * Everything the canvas needs derived from the model in one place.
 *
 * The camera is memoised deliberately: the canvas re-runs a command whenever its
 * object identity changes, so rebuilding one every render would drag the viewer back
 * to the anchor each time they panned.
 */
function useFloorProjection(
  model: VigilModel,
  openedThreadId: string | null,
  onOpen: (threadId: string) => void,
) {
  const followAttention = useCallback(() => {
    if (model.attentionLanternId) onOpen(model.attentionLanternId);
  }, [model.attentionLanternId, onOpen]);

  const { nodes, edges } = useMemo(
    () => projectVigilFloor(model, openedThreadId, { onOpen, onFollowAttention: followAttention }),
    [followAttention, model, onOpen, openedThreadId],
  );

  const recordsByNodeId = useMemo(() => new Map(
    nodes
      .filter((node) => node.type !== 'vigilHero')
      .map((node) => [node.id, node.data.record as ObjectRecord]),
  ), [nodes]);

  const rayNodeIds = useMemo(() => nodes
    .filter((node) => node.type === 'vigilMoment' || (isLantern(node) && node.data.opened))
    .map((node) => node.id), [nodes]);

  const camera = useMemo(
    () => cameraCommand(openedThreadId, rayNodeIds),
    [openedThreadId, rayNodeIds],
  );

  return { nodes, edges, recordsByNodeId, camera };
}
