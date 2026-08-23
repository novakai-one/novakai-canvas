import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { CanvasLibrary, DiagramSummary } from './application/canvas-library';
import type { DiagramExportFormat, DiagramExportService } from './diagram-export/contract';
import type { CanvasWorkspace, RecordCommand } from './application/canvas-workspace';
import type { JsonRepository } from './application/json-repository';
import { asId } from './domain/id-cast';
import type { InterfaceId, NodeId } from './domain/ids';
import type { CanvasPreferences, Selection } from './domain/model';
import { projectView } from './canvas';
import { CanvasSurface } from './presentation/components/canvas-surface';
import { Inspector } from './presentation/components/inspector';
import { Rail } from './presentation/components/rail';
import { diagramContents } from './presentation/components/diagram-contents';
import {
  createCanvasNode, placedNodes, type CreatableNodeKind,
} from './presentation/canvas-actions';
import { canvasCamera } from './presentation/canvas-camera';
import { CanvasPortalProvider, ShellGeometryProvider, targetScale } from './presentation/shell';
import { useWorkspaceRecord } from './presentation/use-workspace-record';
import { wireToneCssVariables } from './presentation/wire-styles';
import { DEFAULT_CANVAS_MODE, type CanvasMode } from './presentation/view-mode';

/** What the host hands the app once the library and the first diagram have been read. */
export interface AppProps {
  library: CanvasLibrary;
  initialDiagramId: string;
  initialWorkspace: CanvasWorkspace;
  initialPreferences: CanvasPreferences;
  preferencesRepository: JsonRepository<CanvasPreferences>;
  diagramExporter: DiagramExportService;
  /** Lets an embedding host remember navigation without retaining the Canvas render tree. */
  onActiveDiagramChange?: (diagramId: string) => void;
}

/** How much air each density setting puts between things, as a multiplier on the 4px grid. */
const DENSITY_SCALE: Record<CanvasPreferences['appearance']['density'], number> = {
  compact: 0.85,
  comfortable: 1,
  roomy: 1.25,
};

/** One open diagram: its identity and the workspace holding its content. */
interface OpenDiagram { id: string; workspace: CanvasWorkspace }

const SAVE_STATUS = {
  saved: 'Saved',
  saving: 'Saving',
  /** A record changed underneath this session. The edits stay; the user decides what to do. */
  stale: 'File changed on disk — your edits are unsaved',
  failed: 'Not saved',
  refused: 'Change not applied',
} as const;

/** Composes the diagram library and one open workspace with replaceable presentation. */
export default function App(props: AppProps) {
  const {
    diagramExporter, initialDiagramId, initialPreferences, initialWorkspace, library,
    onActiveDiagramChange, preferencesRepository,
  } = props;
  const [open, setOpen] = useState<OpenDiagram>(
    () => ({ id: initialDiagramId, workspace: initialWorkspace }),
  );
  const record = useWorkspaceRecord(open.workspace);
  const view = useMemo(() => projectView(record), [record]);
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>(
    () => library.list({ includeArchived: true }),
  );
  const [preferences, setPreferences] = useState(initialPreferences);
  const [selection, setSelection] = useState<Selection>(null);
  /** The diagram just created, whose name the user has not typed yet. Spent on first rename. */
  const [freshDiagramId, setFreshDiagramId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>(SAVE_STATUS.saved);
  const [mode, setMode] = useState<CanvasMode>(DEFAULT_CANVAS_MODE);
  const [history, setHistory] = useState<string[]>([]);
  const savedPreferences = useRef(JSON.stringify(initialPreferences));
  // The revision each open diagram was last written at. A save that fails leaves its entry
  // behind, so the next edit tries again rather than pretending the work is on disk.
  const persisted = useRef(new Map<string, number>([[initialDiagramId, record.revision]]));

  useEffect(() => {
    onActiveDiagramChange?.(open.id);
  }, [onActiveDiagramChange, open.id]);

  const refreshDiagrams = useCallback(
    () => setDiagrams(library.list({ includeArchived: true })),
    [library],
  );

  useEffect(() => {
    if (!preferences.files.autoSave) return;
    if (persisted.current.get(open.id) === record.revision) return;
    setSaveStatus(SAVE_STATUS.saving);
    const timer = window.setTimeout(() => {
      const saving = open.workspace.snapshot().revision;
      void library.save(open.id).then((outcome) => {
        if (outcome.status === 'written') {
          persisted.current.set(open.id, saving);
          setSaveStatus(SAVE_STATUS.saved);
          refreshDiagrams();
          return;
        }
        // Something else — usually ./canvas apply — wrote the record after this session read it.
        // Reloading here silently threw the user's unsaved edits away while the status still read
        // "Saved". Their work stays; they are told; they decide.
        setSaveStatus(outcome.status === 'stale-revision' ? SAVE_STATUS.stale : SAVE_STATUS.failed);
      });
    }, preferences.files.saveDelay);
    return () => window.clearTimeout(timer);
  }, [library, open, preferences.files.autoSave, preferences.files.saveDelay, record, refreshDiagrams]);

  useEffect(() => {
    const serialized = JSON.stringify(preferences);
    if (serialized === savedPreferences.current) return;
    const timer = window.setTimeout(() => {
      void preferencesRepository.save(preferences)
        .then(() => { savedPreferences.current = serialized; })
        .catch(() => setSaveStatus('Preferences not saved'));
    }, preferences.files.saveDelay);
    return () => window.clearTimeout(timer);
  }, [preferences, preferencesRepository]);

  /**
   * Several commands, one revision, one undo.
   *
   * A gesture that produces two facts — dragging a wire onto empty canvas makes a node AND the
   * wire to it — is still one act to the person who made it, so it has to come back off the
   * history in one press. The workspace has always accepted a batch; the host only ever used
   * the single-command convenience.
   */
  const executeAll = useCallback((commands: RecordCommand[]) => {
    if (commands.length === 0) return;
    const outcome = open.workspace.submit({
      operationId: `studio-${crypto.randomUUID()}`,
      expectedRevision: open.workspace.snapshot().revision,
      timestamp: new Date().toISOString(),
      commands,
    });
    if (outcome.status === 'applied') return;
    console.warn('[canvas] batch not applied', outcome, commands);
    setSaveStatus(SAVE_STATUS.refused);
  }, [open.workspace]);

  const execute = useCallback((command: RecordCommand) => {
    const outcome = open.workspace.execute(command);
    if (outcome.status === 'applied') return;
    // A refused command is a bug or a race, never a no-op worth hiding: say so on screen and
    // leave the detail in the console for whoever is looking.
    console.warn('[canvas] change not applied', outcome, command);
    setSaveStatus(SAVE_STATUS.refused);
  }, [open.workspace]);

  const select = useCallback((next: Selection) => setSelection(next), []);

  /**
   * Opens another diagram through the library.
   *
   * The library owns workspace identity: opening the same diagram twice returns the workspace
   * that is already open, so unsaved edits survive switching away and back.
   */
  const openDiagram = useCallback(async (diagramId: string): Promise<CanvasWorkspace | null> => {
    const opened = await library.open(diagramId);
    if (!('snapshot' in opened)) {
      console.warn('[canvas] diagram could not be opened', opened);
      setSaveStatus(SAVE_STATUS.failed);
      return null;
    }
    if (!persisted.current.has(diagramId)) {
      persisted.current.set(diagramId, opened.snapshot().revision);
    }
    setOpen({ id: diagramId, workspace: opened });
    setSelection(null);
    // Switching away spends the new-diagram focus flag with everything else session-local.
    setFreshDiagramId(null);
    setSaveStatus(SAVE_STATUS.saved);
    return opened;
  }, [library]);

  const changeDiagram = useCallback((diagramId: string) => {
    if (diagramId === open.id) return;
    void openDiagram(diagramId);
  }, [open.id, openDiagram]);

  /**
   * Opens a diagram and lands on the object a search result named.
   *
   * The library index stores object *labels*, not ids — enough to answer "which diagram is this
   * in", not enough to point at the thing. So the id is resolved against the record once it is
   * loaded. That is a lookup at the moment of use, not a stored join: nothing durable ever
   * refers to an object by its name.
   */
  const openAtObject = useCallback((diagramId: string, label: string) => {
    void openDiagram(diagramId).then((opened) => {
      if (!opened) return;
      const record = opened.snapshot();
      const match = Object.values(record.nodes).find((node) => node.label === label);
      if (!match) return;
      setSelection({ kind: 'node', id: match.id as string });
      canvasCamera().centerOnNode(match.id as string);
    });
  }, [openDiagram]);

  const drillInto = useCallback((diagramId: string) => {
    const from = open.id;
    void openDiagram(diagramId).then((opened) => {
      if (opened) setHistory((trail: string[]) => [...trail, from]);
    });
  }, [open.id, openDiagram]);

  const goBack = useCallback(() => {
    const target = history.at(-1);
    if (!target) return;
    void openDiagram(target).then((opened) => {
      if (opened) setHistory((trail) => trail.slice(0, -1));
    });
  }, [history, openDiagram]);

  const createDiagram = useCallback(() => {
    const diagramId = `diagram-${crypto.randomUUID().slice(0, 8)}`;
    const name = 'Untitled diagram';
    void library.create(name, diagramId).then(async (created) => {
      if (!('nodeLabels' in created)) {
        console.warn('[canvas] diagram could not be created', created);
        setSaveStatus(SAVE_STATUS.failed);
        return;
      }
      refreshDiagrams();
      const opened = await openDiagram(diagramId);
      if (!opened) return;
      // Every migrated diagram is one root container holding its objects; a new one starts the
      // same way, so `+ Add` has somewhere to put things and the canvas is not a blank void.
      opened.execute({
        kind: 'node.add',
        node: {
          id: asId<NodeId>(diagramId), kind: 'group', label: name, interfaceIds: [], typeIds: [],
        },
        placement: { position: { x: 0, y: 0 }, size: { width: 1000, height: 700 } },
      });
      /*
       * Born nameless: select nothing, so the panel shows the diagram itself — not the root
       * node — and flag it so the header's title field wakes up focused with "Untitled
       * diagram" selected, ready to type over.
       */
      setSelection(null);
      setFreshDiagramId(diagramId);
    });
  }, [library, openDiagram, refreshDiagrams]);

  const setDiagramStatus = useCallback((diagramId: string, status: 'active' | 'archived') => {
    void library.setStatus(diagramId, status).then((outcome) => {
      if (!('nodeLabels' in outcome)) {
        console.warn('[canvas] diagram status unchanged', outcome);
        setSaveStatus(SAVE_STATUS.failed);
        return;
      }
      refreshDiagrams();
      if (status !== 'archived' || diagramId !== open.id) return;
      const next = library.list().find((entry) => entry.id !== diagramId);
      if (next) void openDiagram(next.id);
    });
  }, [library, open.id, openDiagram, refreshDiagrams]);

  // Mode changes what you may do, not what you are looking at — selection stays.
  const changeMode = useCallback((next: CanvasMode) => {
    setMode(next);
  }, []);

  /**
   * Panel geometry is a preference, not session state.
   *
   * Widths and collapsed edges ride the same debounced write as everything else in
   * preferences, so the shape you leave the studio in is the shape you come back to.
   */
  const setPanel = useCallback((patch: Partial<CanvasPreferences['panel']>) => {
    setPreferences((current) => ({ ...current, panel: { ...current.panel, ...patch } }));
  }, []);

  /**
   * Placing a shape, in one place.
   *
   * The left panel owns this now; the Studio used to carry a six-button grid because it had the
   * room, not because creating things has anything to do with inspecting them.
   */
  const addNode = useCallback((kind: CreatableNodeKind) => {
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const created = createCanvasNode(placedNodes(view), kind, id, canvasCamera().focusPoint());
    execute({ kind: 'node.add', ...created });
    select({ kind: 'node', id: created.node.id });
  }, [execute, select, view]);

  /** Travel to an object: select it, then let the camera ease to it. */
  const jumpTo = useCallback((next: Selection) => {
    select(next);
    if (next?.kind === 'node') canvasCamera().centerOnNode(next.id);
  }, [select]);

  const contents = useMemo(() => diagramContents(record, view), [record, view]);

  /** Exports the current in-memory record, then performs the browser's sole clipboard write. */
  const copyDiagram = useCallback(async (format: DiagramExportFormat): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(await diagramExporter.render([record], format));
      return true;
    } catch (error) {
      console.warn('[canvas] diagram copy failed', error);
      setSaveStatus('Could not copy');
      return false;
    }
  }, [diagramExporter, record]);

  const shellStyle = {
    '--density': String(DENSITY_SCALE[preferences.appearance.density] ?? 1),
    '--text-scale': String(preferences.appearance.textScale ?? 1),
    '--target-scale': String(targetScale(preferences.canvas.targetSize ?? 'medium').multiplier),
    '--node-radius': `${preferences.appearance.radius}px`,
    ...wireToneCssVariables(preferences.appearance.theme),
  } as CSSProperties;
  const railCollapsed = preferences.panel.railCollapsed ?? false;
  const studioCollapsed = preferences.panel.studioCollapsed ?? false;
  return (
    <ShellGeometryProvider
      value={{
        railCollapsed,
        studioCollapsed,
        toggleRail: () => setPanel({ railCollapsed: !railCollapsed }),
        toggleStudio: () => setPanel({ studioCollapsed: !studioCollapsed }),
      }}
    >
      <div
        className={`app-shell mode-${mode}`}
        data-accent={preferences.appearance.accent}
        data-dividers={(preferences.panel.showDividers ?? true) ? undefined : 'off'}
        data-theme={preferences.appearance.theme}
        style={shellStyle}
      >
      <CanvasPortalProvider>
      <Rail
        activeDiagramId={open.id}
        activeDiagramName={record.name}
        addNode={addNode}
        canUndo={open.workspace.canUndo()}
        changeDiagram={changeDiagram}
        collapsed={railCollapsed}
        contents={contents}
        createDiagram={createDiagram}
        defaultTab={preferences.panel.leftDefaultTab ?? 'build'}
        diagrams={diagrams}
        editable={mode === 'edit'}
        jumpTo={jumpTo}
        openAtObject={openAtObject}
        select={select}
        selection={selection}
        setDiagramStatus={setDiagramStatus}
        setWidth={(railWidth) => setPanel({ railWidth })}
        undo={() => { open.workspace.undo(); }}
        width={preferences.panel.railWidth ?? 264}
      />
      <ReactFlowProvider>
        <CanvasSurface
          activeDiagramId={open.id}
          canGoBack={history.length > 0}
          canUndo={open.workspace.canUndo()}
          changeDiagram={changeDiagram}
          changeMode={changeMode}
          createDiagram={createDiagram}
          diagrams={diagrams}
          execute={execute}
          executeAll={executeAll}
          goBack={goBack}
          mode={mode}
          preferences={preferences}
          record={record}
          saveStatus={saveStatus}
          selection={selection}
          setDiagramStatus={setDiagramStatus}
          setSelection={select}
          undo={() => { open.workspace.undo(); }}
          view={view}
        />
      </ReactFlowProvider>
      <Inspector
        copyDiagram={copyDiagram}
        addInterface={(ownerId) => {
          const id = `iface-${crypto.randomUUID().slice(0, 8)}`;
          execute({
            kind: 'interface.add',
            ownerId,
            iface: { id: asId<InterfaceId>(id), ownerId: asId<NodeId>(ownerId), name: 'newCall', accepts: [], returns: [] },
          });
          select({ kind: 'interface', id });
        }}
        clearSelection={() => setSelection(null)}
        collapsed={studioCollapsed}
        diagrams={diagrams}
        editable={mode === 'edit'}
        execute={execute}
        executeAll={(commands) => {
          // The first batched act on a fresh diagram is its rename — that spends the flag,
          // so the title field stops re-selecting the text under the user's typing.
          setFreshDiagramId(null);
          executeAll(commands);
        }}
        focusTitle={open.id === freshDiagramId}
        openDiagram={drillInto}
        preferences={preferences}
        record={record}
        select={select}
        selection={selection}
        setWidth={(width) => setPanel({ width })}
        updatePreferences={setPreferences}
        view={view}
      />
      </CanvasPortalProvider>
      </div>
    </ShellGeometryProvider>
  );
}
