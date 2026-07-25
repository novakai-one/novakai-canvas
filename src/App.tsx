import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { CanvasEngine } from './application/canvas-engine';
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
  preferencesRepository: JsonRepository<CanvasPreferences>;
}

/** Composes the canvas engine with replaceable presentation adapters. */
export default function App({ engine, initialPreferences, preferencesRepository }: AppProps) {
  const document = useCanvasEngine(engine);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<InspectorTab>(initialPreferences.panel.defaultTab);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [mode, setMode] = useState<CanvasMode>(DEFAULT_CANVAS_MODE);
  const [requestedMapId, setRequestedMapId] = useState(() =>
    resolveArchitectureMap(engine.snapshot(), undefined));
  const savedPreferences = useRef(JSON.stringify(initialPreferences));
  const maps = useMemo(() => listArchitectureMaps(document), [document]);
  const activeMapId = resolveArchitectureMap(document, requestedMapId);
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
          // Someone else (e.g. the canvas CLI) wrote the file first — their version wins.
          void engine.reload().then(() => setSaveStatus('Saved'));
          return;
        }
        setSaveStatus('Local changes');
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
          changeMap={changeMap}
          changeMode={changeMode}
          document={focusedDocument}
          engine={engine}
          maps={maps}
          mode={mode}
          preferences={preferences}
          saveStatus={saveStatus}
          selection={selection}
          setSelection={select}
        />
      </ReactFlowProvider>
      {mode === 'edit' && (
        <Inspector
          clearSelection={() => setSelection(null)}
          document={document}
          execute={engine.execute}
          preferences={preferences}
          replace={engine.replace}
          selection={selection}
          setTab={setTab}
          tab={tab}
          updatePreferences={setPreferences}
        />
      )}
    </div>
  );
}
