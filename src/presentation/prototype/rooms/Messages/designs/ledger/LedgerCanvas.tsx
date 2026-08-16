/**
 * The Ledger's layout policy on top of the shared WorldCanvas runtime.
 *
 * Bands form one measured vertical document. This design owns the stacking and
 * scenery; WorldCanvas owns React Flow, viewport memory and camera execution.
 */
import {
  applyNodeChanges,
  type CoordinateExtent,
  type NodeChange,
  type Viewport,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorldCanvas } from '../../../../components/canvas/WorldCanvas';
import type { WorldCameraCommand } from '../../../../components/canvas/world-camera';
import { BAND_WIDTH, SPINE_X } from './ledger-geometry';
import { readingZoom, type LedgerCameraRequest, type LedgerTier } from './ledger-camera';
import { LedgerBandNode, type LedgerNode } from './LedgerBandNode';
import { LedgerScene, type BandPlacement } from './LedgerScene';

const nodeTypes = { 'ledger-band': LedgerBandNode };
const initialViewport: Viewport = { x: 180, y: 96, zoom: 0.96 };

export type LedgerBandSpec = {
  readonly id: string;
  readonly gapBefore: number;
  readonly estimatedHeight: number;
  /** Everything the scene shows about this band besides its stacked position. */
  readonly scene: Omit<BandPlacement, 'y' | 'height'>;
};

export type LedgerCanvasProps = {
  viewportKey: string;
  bands: readonly LedgerBandSpec[];
  tier: LedgerTier;
  cameraRequest: LedgerCameraRequest | null;
  reduceMotion: boolean;
  onViewportChange(viewport: Viewport): void;
  onBandClick(id: string): void;
  onPaneClick(): void;
};

function createLedgerNode(spec: LedgerBandSpec): LedgerNode {
  return {
    id: spec.id,
    type: 'ledger-band',
    position: { x: 0, y: 0 },
    draggable: false,
    data: { bandId: spec.id },
  };
}

/** Positions every band from measured height plus its semantic time gap. */
function stackLedgerNodes(
  nodes: readonly LedgerNode[],
  bands: readonly LedgerBandSpec[],
): LedgerNode[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  let nextY = 0;

  return bands.flatMap((spec) => {
    const node = nodesById.get(spec.id);
    if (!node) return [];

    nextY += spec.gapBefore;
    const stackedNode = node.position.x === 0 && node.position.y === nextY
      ? node
      : { ...node, position: { x: 0, y: nextY } };
    nextY += node.measured?.height ?? spec.estimatedHeight;
    return [stackedNode];
  });
}

function mergeLedgerBands(
  currentNodes: readonly LedgerNode[],
  bands: readonly LedgerBandSpec[],
): LedgerNode[] {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));
  const mergedNodes = bands.map((spec) => currentById.get(spec.id) ?? createLedgerNode(spec));
  return stackLedgerNodes(mergedNodes, bands);
}

function cameraCommandForLedger(
  request: LedgerCameraRequest | null,
  canvasWidth: number,
): WorldCameraCommand | null {
  if (!request) return null;
  if (request.kind === 'viewport') {
    return {
      type: 'set-viewport',
      key: request.key,
      viewport: request.viewport,
      duration: request.duration,
    };
  }

  return {
    type: 'focus-node-at-anchor',
    key: request.key,
    nodeId: request.bandId,
    anchor: { horizontalRatio: 0.5, verticalRatio: 0.08 },
    nodeAnchor: { horizontalRatio: 0.5, verticalRatio: 0 },
    zoom: readingZoom(canvasWidth),
    duration: request.duration,
  };
}

function scenePlacements(
  nodes: readonly LedgerNode[],
  bands: readonly LedgerBandSpec[],
): BandPlacement[] {
  const specsById = new Map(bands.map((band) => [band.id, band]));
  return nodes.flatMap((node) => {
    const spec = specsById.get(node.id);
    if (!spec) return [];
    return [{
      ...spec.scene,
      id: node.id,
      y: node.position.y,
      height: node.measured?.height ?? spec.estimatedHeight,
    }];
  });
}

export function LedgerCanvas({
  viewportKey,
  bands,
  tier,
  cameraRequest,
  reduceMotion,
  onViewportChange,
  onBandClick,
  onPaneClick,
}: LedgerCanvasProps) {
  const [nodes, setNodes] = useState<LedgerNode[]>(() => mergeLedgerBands([], bands));
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const [canvasWidth, setCanvasWidth] = useState(1280);

  useEffect(() => {
    setNodes((currentNodes) => mergeLedgerBands(currentNodes, bands));
  }, [bands]);

  const resolveNodeChanges = useCallback((
    changes: NodeChange<LedgerNode>[],
    currentNodes: readonly LedgerNode[],
  ) => stackLedgerNodes(applyNodeChanges(changes, [...currentNodes]), bands), [bands]);

  const bottom = nodes.reduce((largestBottom, node) => Math.max(
    largestBottom,
    node.position.y + (node.measured?.height ?? 0),
  ), 0);
  const translateExtent: CoordinateExtent = [
    [SPINE_X - 660, -780],
    [BAND_WIDTH + 740, bottom + 880],
  ];
  const placements = useMemo(() => scenePlacements(nodes, bands), [bands, nodes]);
  const command = useMemo(
    () => cameraCommandForLedger(cameraRequest, canvasWidth),
    [cameraRequest, canvasWidth],
  );

  return (
    <div
      className="ledger-canvas"
      data-tier={tier}
      ref={(element) => {
        if (element?.clientWidth) setCanvasWidth(element.clientWidth);
      }}
    >
      <WorldCanvas<LedgerNode>
        viewportKey={viewportKey}
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        selectedId={null}
        onSelect={(id) => id ? onBandClick(id) : onPaneClick()}
        onViewportChange={(nextViewport) => {
          setViewport(nextViewport);
          onViewportChange(nextViewport);
        }}
        resolveNodeChanges={resolveNodeChanges}
        onNodesChanged={(nextNodes) => setNodes([...nextNodes])}
        cameraCommand={command}
        interaction={{
          nodesDraggable: false,
          elementsSelectable: false,
          panOnScroll: true,
          panOnScrollDirection: 'vertical',
          zoomOnScroll: false,
          minZoom: 0.3,
          maxZoom: 1.4,
          translateExtent,
          rememberNodePositions: false,
        }}
        initialViewport={initialViewport}
        fitViewOnMount={false}
        canvasChildren={(
          <LedgerScene
            placements={placements}
            viewport={viewport}
            reduceMotion={reduceMotion}
          />
        )}
      />
    </div>
  );
}
