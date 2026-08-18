import { type EdgeTypes, type NodeTypes } from '@xyflow/react';
import type { KeyboardEvent } from 'react';
import { WorldCanvas } from '../../../../components/canvas/WorldCanvas';
import type { WorldCanvasInteraction } from '../../../../components/canvas/canvas-interaction';
import type { MessagesDesignProps } from '../../messages-design';
import { BENCH_VIEWPORT_KEY } from './model/bench-model';
import { useBenchController } from './model/useBenchController';
import { ConversationNode } from './nodes/ConversationNode';
import { InspectionWire } from './nodes/InspectionWire';
import { MessageInspectorNode } from './nodes/MessageInspectorNode';
import { RelatedObjectNode } from './nodes/RelatedObjectNode';
import './the-bench.css';

const benchNodeTypes = {
  'bench-conversation': ConversationNode,
  'bench-message-inspector': MessageInspectorNode,
  'bench-related-object': RelatedObjectNode,
} satisfies NodeTypes;

const benchEdgeTypes = {
  'bench-inspection': InspectionWire,
} satisfies EdgeTypes;

const BENCH_INTERACTION: WorldCanvasInteraction = {
  nodesDraggable: true,
  nodeDragAxis: 'both',
  elementsSelectable: true,
  selectionOnDrag: false,
  panOnDrag: true,
  panOnScroll: true,
  panOnScrollDirection: 'free',
  zoomOnScroll: false,
  zoomOnPinch: true,
  zoomOnDoubleClick: false,
  minZoom: 0.24,
  maxZoom: 1.5,
  rememberNodePositions: true,
  rememberViewport: true,
};

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches('input, textarea, [contenteditable="true"]');
}

/** Composes the Bench controller with shared canvas contracts and no private mechanics. */
export function TheBench(props: MessagesDesignProps) {
  const controller = useBenchController(props);
  const activeThreadId = props.data.selected?.kind === 'thread'
    ? props.data.selected.id
    : controller.state.session.openThreadIds.at(-1) ?? null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isTextInput(event.target)) return;
    if (!['f', 'F', '[', ']'].includes(event.key)) return;
    event.preventDefault();
    controller.onKeyInput({
      key: event.key,
      metaKey: event.metaKey,
      activeThreadId,
    });
  };

  return (
    <div
      className="the-bench"
      data-bench-theme="night-instrument"
      data-zoom-tier={controller.state.zoomTier}
      data-focused-thread={controller.state.session.focusedThreadId ?? 'none'}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="The Bench conversation canvas"
    >
      <WorldCanvas
        viewportKey={BENCH_VIEWPORT_KEY}
        nodes={controller.projection.nodes}
        edges={controller.projection.edges}
        nodeTypes={benchNodeTypes}
        edgeTypes={benchEdgeTypes}
        selectedId={controller.selectedId}
        onSelect={controller.onCanvasSelect}
        resolveSelectionId={(node) => node.data.selectionId}
        onZoomChange={controller.onZoomChange}
        onViewportChange={controller.onViewportChange}
        dragGrid={{ xStep: 8, yStep: 8 }}
        onPaneDoubleClick={controller.onPaneDoubleClick}
        onPlacementChange={controller.onPlacementChange}
        cameraCommand={controller.cameraCommand}
        interaction={BENCH_INTERACTION}
        initialViewport={{ x: 36, y: 40, zoom: 0.82 }}
        fitViewOnMount={false}
        showControls={false}
        surfaceClassName="the-bench__canvas"
        canvasChildren={<div className="the-bench__field" aria-hidden="true" />}
        screenChildren={(
          <div className="the-bench__scale" aria-hidden="true">
            <span>Bench scale</span>
            <strong>{controller.state.zoomTier}</strong>
            <small><kbd>[</kbd><kbd>]</kbd> scale · <kbd>F</kbd> focus</small>
          </div>
        )}
      />
    </div>
  );
}
