import {
  useCallback, useEffect, useMemo, useRef, useState, type CSSProperties,
} from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, Controls, ReactFlow,
  type NodeChange,
} from '@xyflow/react';
import type { DiagramSummary } from '../../application/canvas-library';
import type { RecordCommand } from '../../application/canvas-workspace';
import type { CanvasPreferences, Selection } from '../../domain/model';
import type { ProjectedView } from '../../domain/project-view';
import type { DiagramRecord } from '../../domain/records';
import {
  placedNodes, resolveDrop, type WorldPoint,
} from '../canvas-actions';
import { RailToggle, StudioToggle, targetScale } from '../shell';
import { projectEdges, projectNodes } from '../projection';
import { applyFrame, clearInFlight, mergeInFlight, takeInFlight, type InFlight } from '../in-flight';
import type { CanvasMode } from '../view-mode';
import { webRenderers } from '../../components/web-registry.tsx';
import { ElbowEdge } from '../edges/elbow-edge';
import { Legend } from './legend';
import { CanvasToolbar } from './canvas-toolbar';
import { wireLabelSizing } from '../wire-styles';
import { useCanvasActivity } from '../shell/canvas-activity-context';
import { ConnectionCreationPicker } from './connection-creation-picker.tsx';
import { useConnectionGestures } from './use-connection-gestures.ts';
import { useCanvasCamera, useRefitWhenPanelsMove } from './use-canvas-camera.ts';
import { useCanvasShortcuts } from './use-canvas-shortcuts.ts';

const nodeTypes = webRenderers;
const edgeTypes = { elbow: ElbowEdge };

/** Everything the canvas and its toolbar need from the open diagram and from the library. */
export interface CanvasSurfaceProps {
  record: DiagramRecord;
  view: ProjectedView;
  preferences: CanvasPreferences;
  selection: Selection;
  setSelection: (selection: Selection) => void;
  /** The one way the canvas changes anything; every intention reaches the open workspace here. */
  execute: (command: RecordCommand) => void;
  /** Several commands as one revision, for a gesture that produces more than one fact. */
  executeAll: (commands: RecordCommand[]) => void;
  saveStatus: string;
  diagrams: DiagramSummary[];
  activeDiagramId: string;
  mode: CanvasMode;
  changeDiagram: (diagramId: string) => void;
  changeMode: (mode: CanvasMode) => void;
  canGoBack: boolean;
  goBack: () => void;
  canUndo: boolean;
  undo: () => void;
  createDiagram: () => void;
  setDiagramStatus: (diagramId: string, status: 'active' | 'archived') => void;
}

/*
 * Gesture frames go to the in-flight overlay, not the record: React Flow is controlled,
 * so the overlay is what lets a drag or resize be seen while it happens, and keeping the
 * frames out of `execute` is what keeps one gesture one undoable act (d5f5980). The
 * position that becomes a fact is the one drag-stop / resize-end resolves. Removals are
 * not a gesture — they execute immediately, as before — but they still end one: a node
 * deleted mid-gesture takes its frames with it, or they linger as a ghost the next
 * resize could commit.
 */
function applyNodeChanges(
  execute: (command: RecordCommand) => void,
  frame: (change: NodeChange) => void,
  changes: NodeChange[],
): void {
  changes.forEach((change) => {
    if (change.type === 'remove') execute({ kind: 'node.remove', id: change.id });
    frame(change);
  });
}

/**
 * Re-homes a node by where it was dropped.
 *
 * Membership follows placement, so a drop is two facts: which frame now holds the node, and
 * where it sits inside that frame. The frame only changes when it actually changed, so an
 * ordinary nudge inside a group writes no re-parent at all.
 */
function applyDrop(
  executeAll: (commands: RecordCommand[]) => void,
  view: ProjectedView,
  moved: { id: string; parentId?: string; position: WorldPoint },
): void {
  const placed = placedNodes(view);
  const landed = resolveDrop(placed, moved.id, moved.position, moved.parentId);
  executeAll([
    ...(landed.parentId !== moved.parentId
      ? [{ kind: 'node.reparent' as const, id: moved.id, parentId: landed.parentId }]
      : []),
    { kind: 'node.move', id: moved.id, position: landed.position },
  ]);
}

/** Interactive editor or clean, read-only presentation of one open diagram record. */
export function CanvasSurface(props: CanvasSurfaceProps) {
  const {
    activeDiagramId, execute, executeAll, mode, preferences, record, selection, setSelection, view,
  } = props;
  const active = useCanvasActivity();
  const editable = mode === 'edit';
  const labelSizing = wireLabelSizing(preferences);
  const camera = useCanvasCamera(activeDiagramId);
  const connections = useConnectionGestures({
    editable, resetKey: activeDiagramId, view, executeAll, setSelection, surface: camera.surface,
    toWorld: camera.toWorld,
  });
  useCanvasShortcuts({
    active,
    canUndo: editable && props.canUndo,
    escapeActive: active && !connections.pendingConnection,
    record,
    selection,
    setSelection,
    undo: props.undo,
  });
  useRefitWhenPanelsMove(preferences.panel);
  const [inFlight, setInFlight] = useState<InFlight>({});
  /*
   * d3-drag invokes gesture-end handlers with the listeners from the render where the gesture
   * *started*, so an end callback closes over the overlay as it was then — empty. State still
   * drives the render (the nodes memo depends on it), but every write also lands in this ref,
   * and gesture-end handlers read and clear through the ref, never through the closure.
   */
  const inFlightRef = useRef<InFlight>({});
  const updateInFlight = useCallback((frame: (current: InFlight) => InFlight): void => {
    const next = frame(inFlightRef.current);
    inFlightRef.current = next;
    setInFlight(next);
  }, []);
  // A leftover gesture from another diagram or from Present mode must not cross that boundary.
  useEffect(() => updateInFlight(() => ({})), [activeDiagramId, editable, updateInFlight]);

  /*
   * The committed projection must not depend on gesture frames. React Flow keeps DOM measurements
   * against these object identities; rebuilding every node for one moving node makes every edge
   * temporarily lose an initialized endpoint.
   */
  const projectedNodes = useMemo(
    () => projectNodes({
      view, record, preferences, selection, editable, select: setSelection, execute,
      // A resize moves two facts for north/west handles — where the corner sits and how big
      // the box is — and one fact for the rest. Either way it is one gesture, so it commits
      // as one revision through executeAll, straight from the frames the overlay accumulated.
      // The resizer's own onResizeEnd params are deliberately unused: the overlay holds the
      // same values React Flow reported, already in node.position coordinates.
      resizeEnd: editable
        ? (id: string) => {
          // Read through the ref: this fires on d3-drag's gesture-start listeners, so the
          // `inFlight` this closure captured is the empty overlay from when the drag began.
          const { frame, rest } = takeInFlight(inFlightRef.current, id);
          if (!frame) return;
          executeAll([
            ...(frame.position ? [{ kind: 'node.move' as const, id, position: frame.position }] : []),
            ...(frame.size ? [{
              kind: 'node.resize' as const, id, size: frame.size, sizeMode: 'manual' as const,
            }] : []),
          ]);
          updateInFlight(() => rest);
        }
        : undefined,
    }),
    [editable, execute, executeAll, preferences, record, selection, setSelection, updateInFlight, view],
  );
  const nodes = useMemo(
    () => mergeInFlight(projectedNodes, inFlight),
    [inFlight, projectedNodes],
  );
  const edges = useMemo(
    () => projectEdges({
      view, record, preferences, selection, editable, select: setSelection, execute,
    }),
    [editable, execute, preferences, record, selection, setSelection, view],
  );
  return (
    <main
      className={`canvas-surface is-${mode}`}
      data-connection-gesture={connections.mode}
      ref={camera.surface}
      style={{ '--wire-label-base-size': `${labelSizing.baseSize}px`,
        '--wire-label-max-size': `${labelSizing.maximumSize}px` } as CSSProperties}
    >
      {/*
        * The key names the diagram and nothing else. It used to name the mode too, so every
        * Present/Edit toggle tore React Flow down and rebuilt it, and the camera snapped back to
        * a fresh fit. What a mode changes is what you may do, not what you are looking at, so
        * mode now reaches React Flow only through the interaction props below.
        */}
      <ReactFlow
        key={activeDiagramId}
        colorMode={preferences.appearance.theme} connectionMode={ConnectionMode.Loose} deleteKeyCode={active && editable ? ['Backspace', 'Delete'] : null} edgeTypes={edgeTypes} edges={edges}
        edgesReconnectable={editable} elementsSelectable fitView={camera.fitOnOpen} fitViewOptions={{ padding: editable ? 0.12 : 0.05, maxZoom: 1, minZoom: 0.05 }} minZoom={0.05}
        nodeTypes={nodeTypes} nodes={nodes} nodesConnectable={editable} nodesDraggable={editable}
        {...connections.handlers}
        onEdgeClick={(_event, edge) => setSelection({ kind: 'wire', id: edge.id })}
        onInit={(instance) => { camera.attach(instance); camera.publishZoom(instance.getViewport().zoom); }}
        onMove={(_event, viewport) => camera.publishZoom(viewport.zoom)}
        onMoveEnd={(_event, viewport) => camera.remember(viewport)}
        onNodeDragStop={(_event, node) => {
          if (!editable) return;
          applyDrop(executeAll, view, { id: node.id, parentId: node.parentId, position: node.position });
          // The drop is a fact now; the frames that previewed it must not linger as a ghost.
          updateInFlight((current) => clearInFlight(current, node.id));
        }}
        onNodeClick={(_event, node) => setSelection({ kind: 'node', id: node.id })}
        onNodesChange={(changes) => {
          if (editable) applyNodeChanges(execute, (change) => updateInFlight((current) => applyFrame(current, change)), changes);
        }} onPaneClick={() => { connections.cancelPending(); setSelection(null); }}
        /*
         * Scroll moves the diagram; pinch and ⌘-scroll change how close you are.
         *
         * React Flow ships the opposite, and the opposite is wrong here: Figma, Miro, Lucid and
         * tldraw all pan on a two-finger scroll, so the trained reflex was zooming the canvas
         * every time Chris tried to move around it — and with pinch already bound to zoom, there
         * was no pan gesture on a trackpad at all.
         */
        panOnScroll zoomOnScroll={false} zoomOnPinch
        /*
         * Double-click does nothing rather than zooming.
         *
         * Zoom on double-click is the camera moving itself in response to an ordinary click,
         * which is the one thing the camera must never do. It also sits on the gesture every
         * diagram tool spends on "make a node here" — kept free deliberately, for the lane that
         * adds create-at-cursor.
         */
        zoomOnDoubleClick={false}
        // Dragging the empty canvas moves the canvas — the one gesture everybody tries first.
        // Box selection keeps React Flow's Shift+drag, so nothing is lost by making pan default.
        selectionOnDrag={false} snapGrid={[preferences.canvas.gridSize, preferences.canvas.gridSize]}
        snapToGrid={editable && preferences.canvas.snapToGrid}
        reconnectRadius={targetScale(preferences.canvas.targetSize ?? 'medium').grab / 2}
      >
        {preferences.canvas.showGrid && editable && <Background color={preferences.appearance.theme === 'light' ? '#d9d4c8' : '#34312b'} gap={preferences.canvas.gridSize * 2} variant={BackgroundVariant.Dots} />}
        {/* Fit is never optional: it is the way back when you are lost, so it stays on screen
          * whatever the zoom buttons are set to. */}
        <Controls position="bottom-left" showFitView showInteractive={false} showZoom={preferences.canvas.showControls} />
      </ReactFlow>
      {connections.pendingConnection && <ConnectionCreationPicker at={connections.pendingConnection.picker}
        cancel={connections.cancelPending} pick={connections.createFromPending}
      />}
      <Legend preferences={preferences} view={view} />
      <CanvasToolbar props={props} />
      {/* Anchored to the canvas's own edges, which are exactly the seams the panels open on. */}
      <RailToggle />
      <StudioToggle />
    </main>
  );
}
