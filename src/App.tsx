import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { CanvasLibrary, DiagramSummary } from './application/canvas-library';
import type { CanvasWorkspace, RecordCommand } from './application/canvas-workspace';
import type { JsonRepository } from './application/json-repository';
import { asId } from './domain/id-cast';
import type { NodeId } from './domain/ids';
import type { CanvasPreferences, InspectorTab, Selection } from './domain/model';
import { projectView } from './canvas';
import { CanvasSurface } from './presentation/components/canvas-surface';
import { Inspector } from './presentation/components/inspector';
import { Rail } from './presentation/components/rail';
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
}

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
  const { initialDiagramId, initialPreferences, initialWorkspace, library, preferencesRepository } = props;
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
  const [tab, setTab] = useState<InspectorTab>(initialPreferences.panel.defaultTab);
  const [saveStatus, setSaveStatus] = useState<string>(SAVE_STATUS.saved);
  const [mode, setMode] = useState<CanvasMode>(DEFAULT_CANVAS_MODE);
  const [history, setHistory] = useState<string[]>([]);
  const savedPreferences = useRef(JSON.stringify(initialPreferences));
  // The revision each open diagram was last written at. A save that fails leaves its entry
  // behind, so the next edit tries again rather than pretending the work is on disk.
  const persisted = useRef(new Map<string, number>([[initialDiagramId, record.revision]]));

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

  const execute = useCallback((command: RecordCommand) => {
    const outcome = open.workspace.execute(command);
    if (outcome.status === 'applied') return;
    // A refused command is a bug or a race, never a no-op worth hiding: say so on screen and
    // leave the detail in the console for whoever is looking.
    console.warn('[canvas] change not applied', outcome, command);
    setSaveStatus(SAVE_STATUS.refused);
  }, [open.workspace]);

  const select = useCallback((next: Selection) => {
    setSelection(next);
    if (next) setTab('inspect');
  }, []);

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
    setSaveStatus(SAVE_STATUS.saved);
    return opened;
  }, [library]);

  const changeDiagram = useCallback((diagramId: string) => {
    if (diagramId === open.id) return;
    void openDiagram(diagramId);
  }, [open.id, openDiagram]);

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
      setSelection({ kind: 'node', id: diagramId });
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

  const changeMode = useCallback((next: CanvasMode) => {
    setMode(next);
    setSelection(null);
  }, []);

  const shellStyle = {
    '--node-radius': `${preferences.appearance.radius}px`,
    ...wireToneCssVariables(preferences.appearance.theme),
  } as CSSProperties;
  return (
    <div
      className={`app-shell mode-${mode}`}
      data-accent={preferences.appearance.accent}
      data-theme={preferences.appearance.theme}
      style={shellStyle}
    >
      <Rail
        activeDiagramId={open.id}
        changeDiagram={changeDiagram}
        createDiagram={createDiagram}
        diagrams={diagrams}
        setDiagramStatus={setDiagramStatus}
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
        clearSelection={() => setSelection(null)}
        diagrams={diagrams}
        editable={mode === 'edit'}
        execute={execute}
        openDiagram={drillInto}
        preferences={preferences}
        record={record}
        select={select}
        selection={selection}
        setTab={setTab}
        tab={tab}
        updatePreferences={setPreferences}
        view={view}
      />
    </div>
  );
}
