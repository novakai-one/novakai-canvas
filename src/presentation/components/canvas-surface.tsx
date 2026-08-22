import {
  useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject,
} from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, Controls, ReactFlow,
  type NodeChange, type Viewport,
} from '@xyflow/react';
import type { DiagramSummary } from '../../application/canvas-library';
import type { RecordCommand } from '../../application/canvas-workspace';
import type { CanvasPreferences, Selection } from '../../domain/model';
import type { ProjectedView } from '../../domain/project-view';
import type { DiagramRecord } from '../../domain/records';
import {
  escapeStep, placedNodes, resolveDrop, selectionResolves, type WorldPoint,
} from '../canvas-actions';
import { canvasCamera, publishCanvasCamera } from '../canvas-camera';
import { RailToggle, StudioToggle } from '../shell';
import { projectEdges, projectNodes } from '../projection';
import { applyFrame, clearInFlight, mergeInFlight, takeInFlight, type InFlight } from '../in-flight';
import type { CanvasMode } from '../view-mode';
import { webRenderers } from '../../components/web-registry.tsx';
import { ElbowEdge } from '../edges/elbow-edge';
import { Legend } from './legend';
import { CanvasToolbar } from './canvas-toolbar';
import { wireLabelSizing } from '../wire-styles';
import { useCanvasActivity } from '../shell/canvas-activity-context';
import {
  connectedNode, connectedWire, pickerPosition, sideOfHandle, wireRouteCommand,
  type ConnectionOrigin, type PendingConnection,
} from './connection-creation.ts';
import { ConnectionCreationPicker } from './connection-creation-picker.tsx';

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

/** True while the keystroke belongs to a field the user is typing in, not to the canvas. */
function typingInAField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Escape, owned by the canvas.
 *
 * The canvas is the only thing that knows what "outward" means, so the keystroke is read here
 * rather than in the shell. It never touches the camera — Escape only ever renames the
 * selection, one step at a time, until there is none.
 */
function useEscapeStepsOutward(
  active: boolean,
  record: DiagramRecord,
  selection: Selection,
  setSelection: (selection: Selection) => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || typingInAField(event.target)) return;
      if (!selection) return;
      event.preventDefault();
      setSelection(escapeStep(record, selection));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, record, selection, setSelection]);
}

/**
 * Binds the undo everyone's hands already know.
 *
 * The toolbar button was the only way to undo, which means the reflex every other application
 * on the machine has trained fires into nothing — and the more confident you are that ⌘Z has
 * you, the more expensive its silence is. Typing in a studio field is left to the browser's own
 * text undo, which is what the same keystroke should mean while a caret is in a field.
 */
function useUndoShortcut(active: boolean, canUndo: boolean, undo: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if (key !== 'z' || !(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || typingInAField(event.target)) return;
      event.preventDefault();
      if (canUndo) undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, canUndo, undo]);
}

/**
 * Drops a selection whose object has gone.
 *
 * Undo and delete can retire the selected object while the selection still names it. Left
 * alone, "dim unrelated" then dims every node against a thing that no longer exists and the
 * canvas sits grey with nothing selected. Releasing the selection releases the dim with it.
 */
function useSelectionReleasesWithItsObject(
  record: DiagramRecord,
  selection: Selection,
  setSelection: (selection: Selection) => void,
): void {
  useEffect(() => {
    if (!selectionResolves(record, selection)) setSelection(null);
  }, [record, selection, setSelection]);
}

/** Only the parts of React Flow's instance the camera actually uses. */
interface FlowInstance {
  setViewport: (viewport: Viewport) => unknown;
  getViewport: () => Viewport;
  fitView: (options?: {
    nodes?: { id: string }[]; duration?: number; padding?: number;
    minZoom?: number; maxZoom?: number;
  }) => unknown;
  screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number };
}

/** Calm is slow: travel is a structural move, and the eye must be able to follow it. */
const TRAVEL_MS = 700;

/**
 * Everything about where the canvas is looking.
 *
 * A diagram is a place. Coming back to one and finding a different view of it is the same
 * disorientation as coming back to a document scrolled to a line you never chose, so the camera
 * is remembered per diagram and restored on return. Only a diagram's very first opening earns a
 * fit; after that the user's own framing wins. Memory is deliberately session-scoped — it is a
 * property of this sitting, not of the record, and it never reaches disk.
 *
 * The same hook publishes the travel contract other chrome uses, and answers the one question
 * placement needs: which point in the diagram the user is actually looking at.
 */
function useCamera(activeDiagramId: string): {
  surface: RefObject<HTMLElement | null>;
  fitOnOpen: boolean;
  remember: (viewport: Viewport) => void;
  attach: (instance: FlowInstance) => void;
  publishZoom: (zoom: number) => void;
  focusPoint: () => WorldPoint;
  /** One screen point in diagram coordinates — where a pointer actually let go. */
  toWorld: (point: { x: number; y: number }) => WorldPoint;
} {
  const flow = useRef<FlowInstance | null>(null);
  const surface = useRef<HTMLElement | null>(null);
  const cameras = useRef(new Map<string, Viewport>());
  const remembered = cameras.current.get(activeDiagramId);

  useEffect(() => {
    publishCanvasCamera({
      centerOnNode: (nodeId) => {
        const instance = flow.current;
        if (!instance) return;
        // Travel, not re-framing: the zoom the user chose is pinned, only the centre changes.
        const { zoom } = instance.getViewport();
        instance.fitView({
          nodes: [{ id: nodeId }], duration: TRAVEL_MS, minZoom: zoom, maxZoom: zoom,
        });
      },
      fit: () => flow.current?.fitView({ duration: TRAVEL_MS, padding: 0.12, maxZoom: 1 }),
      focusPoint: () => {
        const instance = flow.current;
        const box = surface.current?.getBoundingClientRect();
        if (!instance || !box) return { x: 0, y: 0 };
        return instance.screenToFlowPosition({
          x: box.x + box.width / 2, y: box.y + box.height / 2,
        });
      },
    });
    return () => publishCanvasCamera(null);
  }, []);

  const publishZoom = useCallback((zoom: number): void => {
    const element = surface.current;
    if (!element) return;
    element.style.setProperty('--nvk-zoom', String(zoom));
  }, []);

  return {
    surface,
    fitOnOpen: remembered === undefined,
    remember: (viewport: Viewport) => { cameras.current.set(activeDiagramId, viewport); },

    /**
     * Publishes the live zoom to CSS so anything that must keep a constant *screen* size can
     * divide by it.
     *
     * Written straight to the node rather than held in state: this fires on every frame of a
     * zoom, and re-rendering the whole canvas at 60fps to move a number is a cost with no
     * benefit. Ports are the reason it exists — drawn inside the scaled viewport they shrank
     * to two physical pixels at the app's own default framing, which is not a small target,
     * it is an invisible one.
     */
    publishZoom,
    attach: (instance: FlowInstance) => {
      flow.current = instance;
      const saved = cameras.current.get(activeDiagramId);
      if (saved) { instance.setViewport(saved); return; }
      // React Flow measures before the shell's panels have their widths, so its own first fit
      // frames a viewport that no longer exists. One more fit after layout settles corrects it.
      window.setTimeout(() => {
        if (!cameras.current.has(activeDiagramId)) {
          instance.fitView({ padding: 0.1, maxZoom: 1, minZoom: 0.05 });
        }
      }, 90);
    },
    focusPoint: () => {
      const instance = flow.current;
      const box = surface.current?.getBoundingClientRect();
      if (!instance || !box) return { x: 0, y: 0 };
      return instance.screenToFlowPosition({
        x: box.x + box.width / 2, y: box.y + box.height / 2,
      });
    },
    toWorld: (point: { x: number; y: number }) =>
      flow.current?.screenToFlowPosition(point) ?? { x: 0, y: 0 },
  };
}

/**
 * Panels push the canvas, so their movement changes what the user can see. When one finishes
 * opening, closing, or resizing, the diagram re-frames itself calmly — the semantics table's
 * one sanctioned camera move that the user did not make with the camera itself.
 */
function useRefitWhenPanelsMove(panel: CanvasPreferences['panel']): void {
  const { railCollapsed, railWidth, reframeOnPanelMove, studioCollapsed, width } = panel;
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) { settled.current = true; return; }
    // Opt-in, and off by default. Moving a panel changes how much of the diagram you can see;
    // it is not a request to look somewhere else, and the camera moving on its own is the one
    // thing Chris has asked for twice that it must never do.
    if (!reframeOnPanelMove) return;
    const timer = window.setTimeout(() => canvasCamera().fit(), TRAVEL_MS + 60);
    return () => window.clearTimeout(timer);
  }, [railCollapsed, railWidth, reframeOnPanelMove, studioCollapsed, width]);
}

/** Interactive editor or clean, read-only presentation of one open diagram record. */
export function CanvasSurface(props: CanvasSurfaceProps) {
  const {
    activeDiagramId, execute, executeAll, mode, preferences, record, selection, setSelection, view,
  } = props;
  const active = useCanvasActivity();
  const editable = mode === 'edit';
  const labelSizing = wireLabelSizing(preferences);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  useEscapeStepsOutward(active && pendingConnection === null, record, selection, setSelection);
  useUndoShortcut(active, editable && props.canUndo, props.undo);
  useSelectionReleasesWithItsObject(record, selection, setSelection);
  const camera = useCamera(activeDiagramId);
  useRefitWhenPanelsMove(preferences.panel);
  /** The port a drag began on, remembered until it lands somewhere or on nothing. */
  const dragFrom = useRef<ConnectionOrigin | null>(null);
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
  useEffect(() => {
    updateInFlight(() => ({}));
    dragFrom.current = null;
    setPendingConnection(null);
  }, [activeDiagramId, editable, updateInFlight]);

  const createFromPending = (kind: Parameters<typeof connectedNode>[2]): void => {
    if (!pendingConnection || !editable) return;
    const created = connectedNode(placedNodes(view), pendingConnection, kind);
    executeAll(created.commands);
    setSelection({ kind: 'node', id: created.nodeId });
    setPendingConnection(null);
  };

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
      ref={camera.surface}
      style={{
        '--wire-label-base-size': `${labelSizing.baseSize}px`,
        '--wire-label-max-size': `${labelSizing.maximumSize}px`,
      } as CSSProperties}
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
        onConnect={(connection) => {
          if (!editable) return;
          const connected = connectedWire(connection);
          if (!connected) return;
          executeAll(connected.commands);
          setPendingConnection(null);
          setSelection({ kind: 'wire', id: connected.id });
        }}
        onConnectStart={(_event, params) => {
          dragFrom.current = params.nodeId
            ? { nodeId: params.nodeId, side: sideOfHandle(params.handleId) }
            : null;
        }}
        onConnectEnd={(event, state) => {
          // A drag that found a port is `onConnect`'s business; only a drop on nothing is ours.
          if (state.isValid) { dragFrom.current = null; return; }
          const from = dragFrom.current;
          dragFrom.current = null;
          if (!editable || !from) return;
          const point = 'changedTouches' in event
            ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
            : { x: event.clientX, y: event.clientY };
          const surface = camera.surface.current?.getBoundingClientRect();
          if (!surface) return;
          setPendingConnection({
            from,
            world: camera.toWorld(point),
            picker: pickerPosition(point, surface),
          });
        }}
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
        onReconnect={(edge, connection) => {
          if (!editable || !connection.source || !connection.target) return;
          const route = wireRouteCommand(edge.id, connection);
          executeAll([{
            kind: 'wire.reconnect', id: edge.id, source: connection.source, target: connection.target,
          }, ...(route ? [route] : [])]);
          // Moving an end to a different port of the same node is a real edit, and the only
          // thing that changed is the side — so the side has to be written, or the next render
          // puts the wire back where the default says it goes.
          setSelection({ kind: 'wire', id: edge.id });
        }}
        onNodeClick={(_event, node) => setSelection({ kind: 'node', id: node.id })}
        onNodesChange={(changes) => {
          if (editable) applyNodeChanges(execute, (change) => updateInFlight((current) => applyFrame(current, change)), changes);
        }} onPaneClick={() => { setPendingConnection(null); setSelection(null); }}
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
      >
        {preferences.canvas.showGrid && editable && <Background color={preferences.appearance.theme === 'light' ? '#d9d4c8' : '#34312b'} gap={preferences.canvas.gridSize * 2} variant={BackgroundVariant.Dots} />}
        {/* Fit is never optional: it is the way back when you are lost, so it stays on screen
          * whatever the zoom buttons are set to. */}
        <Controls position="bottom-left" showFitView showInteractive={false} showZoom={preferences.canvas.showControls} />
      </ReactFlow>
      {pendingConnection && <ConnectionCreationPicker
        at={pendingConnection.picker}
        cancel={() => setPendingConnection(null)}
        pick={createFromPending}
      />}
      <Legend preferences={preferences} view={view} />
      <CanvasToolbar props={props} />
      {/* Anchored to the canvas's own edges, which are exactly the seams the panels open on. */}
      <RailToggle />
      <StudioToggle />
    </main>
  );
}
