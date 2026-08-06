import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, Controls, ReactFlow,
  type Connection, type NodeChange, type Viewport,
} from '@xyflow/react';
import type { DiagramSummary } from '../../application/canvas-library';
import type { RecordCommand } from '../../application/canvas-workspace';
import { asId } from '../../domain/id-cast';
import { NODE_PORTS } from '../../domain/flow';
import type { NodeId, WireId } from '../../domain/ids';
import type { PortSide } from '../../domain/records';
import type { CanvasPreferences, Selection } from '../../domain/model';
import type { ProjectedView } from '../../domain/project-view';
import type { DiagramRecord } from '../../domain/records';
import {
  escapeStep, resolveDrop, selectionResolves, type PlacedNode, type WorldPoint,
} from '../canvas-actions';
import { canvasCamera, publishCanvasCamera } from '../canvas-camera';
import { RailToggle, StudioToggle } from '../shell';
import { projectEdges, projectNodes } from '../projection';
import type { CanvasMode } from '../view-mode';
import { ArchitectureNode } from '../nodes/architecture-node';
import { CommentNode } from '../nodes/comment-node';
import { ScopeNode } from '../nodes/scope-node';
import { TreeNode } from '../nodes/tree-node';
import { ElbowEdge } from '../edges/elbow-edge';
import { Legend } from './legend';
import { CanvasToolbar } from './canvas-toolbar';

const nodeTypes = { architecture: ArchitectureNode, comment: CommentNode, scope: ScopeNode, tree: TreeNode };
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

function applyNodeChanges(execute: (command: RecordCommand) => void, changes: NodeChange[]): void {
  changes.forEach((change) => {
    /*
     * Position is not committed here at all — `onNodeDragStop` owns it.
     *
     * React Flow reports a position change on every frame of a drag, and committing each one
     * pushed dozens of records onto the history for a single gesture, so undo popped one
     * invisible sub-pixel step and read as doing nothing. Even taking only the last frame left
     * two writes for one drag, because the drag-stop handler commits the same move again after
     * running it through the drop rules. The frames in flight are React Flow's to render; the
     * position that becomes a fact is the one drag-stop resolves, and one gesture is one
     * undoable act.
     */
    // Only user-driven resizes (NodeResizer sets resizing) — never React Flow's
    // initial DOM measurements, which would rewrite every stored size on load.
    if (change.type === 'dimensions' && change.dimensions && change.resizing) {
      execute({ kind: 'node.resize', id: change.id, size: change.dimensions });
    }
    if (change.type === 'remove') execute({ kind: 'node.remove', id: change.id });
  });
}

/** The drawn diagram as pure geometry, which is all the placement rules need. */
function placedNodes(view: ProjectedView): PlacedNode[] {
  return view.nodes.map((node) => ({
    id: node.id as string,
    kind: node.kind,
    parentId: node.parentId as string | undefined,
    position: node.position,
    size: node.size,
  }));
}

/**
 * Re-homes a node by where it was dropped.
 *
 * Membership follows placement, so a drop is two facts: which frame now holds the node, and
 * where it sits inside that frame. The frame only changes when it actually changed, so an
 * ordinary nudge inside a group writes no re-parent at all.
 */
function applyDrop(
  execute: (command: RecordCommand) => void,
  view: ProjectedView,
  moved: { id: string; parentId?: string; position: WorldPoint },
): void {
  const placed = placedNodes(view);
  const landed = resolveDrop(placed, moved.id, moved.position, moved.parentId);
  if (landed.parentId !== moved.parentId) {
    execute({ kind: 'node.reparent', id: moved.id, parentId: landed.parentId });
  }
  execute({ kind: 'node.move', id: moved.id, position: landed.position });
}

/**
 * Reads the side a drag actually landed on, if it named one.
 *
 * Port ids are the side names, so a handle id is already the stored value. Anything else — a
 * node kind that has not adopted the shared ports, or a drop React Flow resolved without a
 * handle — returns undefined and leaves the router on its default rather than storing a side
 * that does not exist.
 */
function sideOfHandle(handleId: string | null | undefined): PortSide | undefined {
  return NODE_PORTS.includes(handleId as PortSide) ? (handleId as PortSide) : undefined;
}

/** Records which ports a wire's ends were dropped on, so the next render honours them. */
function rememberSides(
  execute: (command: RecordCommand) => void,
  id: string,
  connection: { sourceHandle?: string | null; targetHandle?: string | null },
): void {
  const preferredSourceSide = sideOfHandle(connection.sourceHandle);
  const preferredTargetSide = sideOfHandle(connection.targetHandle);
  if (!preferredSourceSide && !preferredTargetSide) return;
  execute({ kind: 'wire.setRoute', id, route: { preferredSourceSide, preferredTargetSide } });
}

function connect(execute: (command: RecordCommand) => void, connection: Connection): string | null {
  if (!connection.source || !connection.target) return null;
  const id = `wire-${crypto.randomUUID().slice(0, 8)}`;
  execute({
    kind: 'wire.add',
    wire: {
      id: asId<WireId>(id),
      kind: 'references',
      label: 'connects',
      source: { nodeId: asId<NodeId>(connection.source) },
      target: { nodeId: asId<NodeId>(connection.target) },
    },
  });
  rememberSides(execute, id, connection);
  return id;
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
  record: DiagramRecord,
  selection: Selection,
  setSelection: (selection: Selection) => void,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || typingInAField(event.target)) return;
      if (!selection) return;
      event.preventDefault();
      setSelection(escapeStep(record, selection));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [record, selection, setSelection]);
}

/**
 * Binds the undo everyone's hands already know.
 *
 * The toolbar button was the only way to undo, which means the reflex every other application
 * on the machine has trained fires into nothing — and the more confident you are that ⌘Z has
 * you, the more expensive its silence is. Typing in a studio field is left to the browser's own
 * text undo, which is what the same keystroke should mean while a caret is in a field.
 */
function useUndoShortcut(canUndo: boolean, undo: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if (key !== 'z' || !(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || typingInAField(event.target)) return;
      event.preventDefault();
      if (canUndo) undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canUndo, undo]);
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
    publishZoom: (zoom: number) => {
      surface.current?.style.setProperty('--nvk-zoom', String(zoom));
    },
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
  };
}

/**
 * Panels push the canvas, so their movement changes what the user can see. When one finishes
 * opening, closing, or resizing, the diagram re-frames itself calmly — the semantics table's
 * one sanctioned camera move that the user did not make with the camera itself.
 */
function useRefitWhenPanelsMove(panel: CanvasPreferences['panel']): void {
  const { railCollapsed, railWidth, studioCollapsed, width } = panel;
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) { settled.current = true; return; }
    const timer = window.setTimeout(() => canvasCamera().fit(), TRAVEL_MS + 60);
    return () => window.clearTimeout(timer);
  }, [railCollapsed, railWidth, studioCollapsed, width]);
}

/** Interactive editor or clean, read-only presentation of one open diagram record. */
export function CanvasSurface(props: CanvasSurfaceProps) {
  const {
    activeDiagramId, execute, mode, preferences, record, selection, setSelection, view,
  } = props;
  const editable = mode === 'edit';
  useEscapeStepsOutward(record, selection, setSelection);
  useUndoShortcut(editable && props.canUndo, props.undo);
  useSelectionReleasesWithItsObject(record, selection, setSelection);
  const camera = useCamera(activeDiagramId);
  useRefitWhenPanelsMove(preferences.panel);
  const nodes = useMemo(
    () => projectNodes({
      view, record, preferences, selection, editable, select: setSelection, execute,
    }),
    [editable, execute, preferences, record, selection, setSelection, view],
  );
  const edges = useMemo(
    () => projectEdges({
      view, record, preferences, selection, editable, select: setSelection, execute,
    }),
    [editable, execute, preferences, record, selection, setSelection, view],
  );
  return (
    <main className={`canvas-surface is-${mode}`} ref={camera.surface}>
      {/*
        * The key names the diagram and nothing else. It used to name the mode too, so every
        * Present/Edit toggle tore React Flow down and rebuilt it, and the camera snapped back to
        * a fresh fit. What a mode changes is what you may do, not what you are looking at, so
        * mode now reaches React Flow only through the interaction props below.
        */}
      <ReactFlow
        key={activeDiagramId}
        colorMode={preferences.appearance.theme} connectionMode={ConnectionMode.Loose} deleteKeyCode={editable ? ['Backspace', 'Delete'] : null} edgeTypes={edgeTypes} edges={edges}
        edgesReconnectable={editable} elementsSelectable fitView={camera.fitOnOpen} fitViewOptions={{ padding: editable ? 0.12 : 0.05, maxZoom: 1, minZoom: 0.05 }} minZoom={0.05}
        nodeTypes={nodeTypes} nodes={nodes} nodesConnectable={editable} nodesDraggable={editable}
        onConnect={(connection) => { if (!editable) return; const id = connect(execute, connection); if (id) setSelection({ kind: 'wire', id }); }}
        onEdgeClick={(_event, edge) => setSelection({ kind: 'wire', id: edge.id })}
        onInit={(instance) => { camera.attach(instance); camera.publishZoom(instance.getViewport().zoom); }}
        onMove={(_event, viewport) => camera.publishZoom(viewport.zoom)}
        onMoveEnd={(_event, viewport) => camera.remember(viewport)}
        onNodeDragStop={(_event, node) => {
          if (!editable) return;
          applyDrop(execute, view, { id: node.id, parentId: node.parentId, position: node.position });
        }}
        onReconnect={(edge, connection) => {
          if (!editable || !connection.source || !connection.target) return;
          execute({
            kind: 'wire.reconnect', id: edge.id, source: connection.source, target: connection.target,
          });
          // Moving an end to a different port of the same node is a real edit, and the only
          // thing that changed is the side — so the side has to be written, or the next render
          // puts the wire back where the default says it goes.
          rememberSides(execute, edge.id, connection);
          setSelection({ kind: 'wire', id: edge.id });
        }}
        onNodeClick={(_event, node) => setSelection({ kind: 'node', id: node.id })}
        onNodesChange={(changes) => { if (editable) applyNodeChanges(execute, changes); }} onPaneClick={() => setSelection(null)}
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
      <Legend preferences={preferences} view={view} />
      <CanvasToolbar props={props} />
      {/* Anchored to the canvas's own edges, which are exactly the seams the panels open on. */}
      <RailToggle />
      <StudioToggle />
    </main>
  );
}
