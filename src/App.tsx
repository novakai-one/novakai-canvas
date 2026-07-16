import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { CanvasEngine } from './application/canvas-engine';
import type { JsonRepository } from './application/json-repository';
import type { CanvasPreferences, InspectorTab, Selection } from './domain/model';
import { CanvasSurface } from './presentation/components/canvas-surface';
import { Inspector } from './presentation/components/inspector';
import { useCanvasEngine } from './presentation/use-canvas-engine';

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
  const initialRevision = useRef(document.revision);
  const savedPreferences = useRef(JSON.stringify(initialPreferences));

  useEffect(() => {
    if (!preferences.files.autoSave) return;
    if (document.revision === initialRevision.current) return;
    setSaveStatus('Saving');
    const timer = window.setTimeout(() => {
      void engine.save().then(() => setSaveStatus('Saved')).catch(() => setSaveStatus('Local changes'));
    }, preferences.files.saveDelay);
    return () => window.clearTimeout(timer);
  }, [document, engine, preferences.files.autoSave, preferences.files.saveDelay]);

  useEffect(() => {
    const serialized = JSON.stringify(preferences);
    if (serialized === savedPreferences.current) return;
    const timer = window.setTimeout(() => {
      void preferencesRepository.save(preferences).then(() => { savedPreferences.current = serialized; });
    }, preferences.files.saveDelay);
    return () => window.clearTimeout(timer);
  }, [preferences, preferencesRepository]);

  const select = useCallback((next: Selection) => {
    setSelection(next);
    if (next) setTab('inspect');
  }, []);

  return (
    <div className="app-shell" style={{ '--node-radius': `${preferences.appearance.radius}px` } as CSSProperties}>
      <ReactFlowProvider>
        <CanvasSurface
          document={document}
          engine={engine}
          preferences={preferences}
          saveStatus={saveStatus}
          selection={selection}
          setSelection={select}
        />
      </ReactFlowProvider>
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
    </div>
  );
}
