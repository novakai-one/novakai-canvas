import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { CanvasEngine } from './application/canvas-engine';
import type { DiagramSummary } from './application/canvas-library';
import type { JsonRepository } from './application/json-repository';
import type { CanvasPreferences, InspectorTab, Selection } from './domain/model';
import {
  focusArchitecture, listArchitectureMaps, presentArchitecture, resolveArchitectureMap,
} from './domain/maps';
import { CanvasSurface } from './presentation/components/canvas-surface';
import { Inspector } from './presentation/components/inspector';
import { useCanvasEngine } from './presentation/use-canvas-engine';
import { wireToneCssVariables } from './presentation/wire-styles';
import { DEFAULT_CANVAS_MODE, type CanvasMode } from './presentation/view-mode';

interface AppProps {
  engine: CanvasEngine;
  initialPreferences: CanvasPreferences;
  /**
   * A snapshot of the v3 record-model library's diagram list, when one could be built.
   *
   * Sourced independently of `document`/`maps`: it proves the library seam reads real records
   * from disk without yet driving the rendering pipeline. Undefined in production or if the
   * library was unavailable, in which case the picker falls back to the legacy document.
   */
  libraryDiagrams?: DiagramSummary[];
  preferencesRepository: JsonRepository<CanvasPreferences>;
}

/** Composes the canvas engine with replaceable presentation adapters. */
export default function App({ engine, initialPreferences, libraryDiagrams, preferencesRepository }: AppProps) {
  const document = useCanvasEngine(engine);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<InspectorTab>(initialPreferences.panel.defaultTab);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [mode, setMode] = useState<CanvasMode>(DEFAULT_CANVAS_MODE);
  const [requestedMapId, setRequestedMapId] = useState(() =>
    resolveArchitectureMap(engine.snapshot(), undefined));
  const [mapHistory, setMapHistory] = useState<string[]>([]);
  const savedPreferences = useRef(JSON.stringify(initialPreferences));
  const maps = useMemo(() => listArchitectureMaps(document, true), [document]);
  const activeMapId = resolveArchitectureMap(document, requestedMapId, true);
  const focusedDocument = useMemo(
    () => mode === 'present'
      ? presentArchitecture(document, activeMapId)
      : focusArchitecture(document, activeMapId),
    [activeMapId, document, mode],
  );

  useEffect(() => {
    if (!preferences.files.autoSave) return;
    if (document.revision === engine.persistedRevision()) return;
    setSaveStatus('Saving');
    const timer = window.setTimeout(() => {
      void engine.save().then(() => setSaveStatus('Saved')).catch((error: unknown) => {
        if (error instanceof Error && error.message === 'stale-revision') {
          // Something else — usually ./canvas apply — wrote the file after this session read
          // it. Reloading here silently threw the user's unsaved edits away while the status
          // still read "Saved". Their work stays; they are told; they decide.
          setSaveStatus('File changed on disk — your edits are unsaved');
          return;
        }
        setSaveStatus('Not saved');
      });
    }, preferences.files.saveDelay);
    return () => window.clearTimeout(timer);
  }, [document, engine, preferences.files.autoSave, preferences.files.saveDelay]);

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

  const select = useCallback((next: Selection) => {
    setSelection(next);
    if (next) setTab('inspect');
  }, []);

  const changeMap = useCallback((mapId: string) => {
    setRequestedMapId(mapId);
    setSelection(null);
  }, []);

  const createDiagram = useCallback(() => {
    const token = crypto.randomUUID().slice(0, 8);
    const diagramId = `diagram-${token}`;
    const rootNodeId = `scope-${token}`;
    engine.execute({
      kind: 'diagram.create',
      diagram: { id: diagramId, rootNodeId, status: 'active', sourceRefs: [] },
      root: { id: rootNodeId, kind: 'scope', label: 'Untitled diagram', interfaceIds: [], typeIds: [] },
      placement: {
        nodeId: rootNodeId, position: { x: 0, y: 0 },
        size: { width: 1000, height: 700 }, pinned: false,
      },
    });
    setRequestedMapId(diagramId);
    setSelection({ kind: 'node', id: rootNodeId });
  }, [engine]);

  const setDiagramStatus = useCallback((diagramId: string, status: 'active' | 'archived') => {
    engine.execute({ kind: 'diagram.setStatus', id: diagramId, status });
    if (status === 'archived' && activeMapId === diagramId) {
      const next = maps.find((map) => map.id !== diagramId && map.status === 'active');
      setRequestedMapId(next?.id);
      setSelection(null);
    }
  }, [activeMapId, engine, maps]);

  const openDiagram = useCallback((diagramId: string) => {
    if (!document.diagrams[diagramId] || document.diagrams[diagramId].status !== 'active') return;
    if (activeMapId) setMapHistory((history) => [...history, activeMapId]);
    setRequestedMapId(diagramId);
    setSelection(null);
  }, [activeMapId, document.diagrams]);

  const goBack = useCallback(() => {
    setMapHistory((history) => {
      const target = history.at(-1);
      if (target) setRequestedMapId(target);
      return target ? history.slice(0, -1) : history;
    });
    setSelection(null);
  }, []);

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
      <ReactFlowProvider>
        <CanvasSurface
          activeMapId={activeMapId}
          canGoBack={mapHistory.length > 0}
          changeMap={changeMap}
          changeMode={changeMode}
          createDiagram={createDiagram}
          document={focusedDocument}
          engine={engine}
          libraryDiagrams={libraryDiagrams}
          maps={maps}
          mode={mode}
          goBack={goBack}
          preferences={preferences}
          saveStatus={saveStatus}
          selection={selection}
          setSelection={select}
          setDiagramStatus={setDiagramStatus}
        />
      </ReactFlowProvider>
      <Inspector
          clearSelection={() => setSelection(null)}
          document={document}
          visibleDocument={focusedDocument}
          select={select}
          editable={mode === 'edit'}
          execute={engine.execute}
          openDiagram={openDiagram}
          preferences={preferences}
          replace={engine.replace}
          selection={selection}
          setTab={setTab}
          tab={tab}
          updatePreferences={setPreferences}
        />
    </div>
  );
}
