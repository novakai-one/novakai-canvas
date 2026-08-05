import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LoadFailure } from './presentation/components/load-failure';

const root = createRoot(document.getElementById('root')!);
const workSessionReport =
  new URLSearchParams(window.location.search).get('report') === 'work-session';

async function bootstrapWorkSessionReport(): Promise<void> {
  root.render(
    <StrictMode>
      <main
        role="status"
        style={{
          display: 'grid',
          width: '100%',
          minHeight: '100vh',
          placeItems: 'center',
          color: '#edf1f4',
          background: '#0d1117',
        }}
      >
        Loading work-session report…
      </main>
    </StrictMode>,
  );
  const { WorkSessionReport } = await import(
    './presentation/work-session-report/WorkSessionReport'
  );
  root.render(
    <StrictMode>
      <WorkSessionReport />
    </StrictMode>,
  );
}

async function bootstrapCanvas(): Promise<void> {
  const [
    { default: App },
    { createCanvasEngine },
    { createHttpJsonRepository },
    { architectureDocumentSchema, canvasPreferencesSchema },
    { defaultPreferences, emptyArchitecture },
  ] = await Promise.all([
    import('./App'),
    import('./application/canvas-engine'),
    import('./adapters/http-json-repository'),
    import('./domain/schema'),
    import('./domain/defaults'),
    import('@xyflow/react/dist/style.css'),
    import('./styles.css'),
  ]);
  const architectureEndpoint = import.meta.env.DEV ? '/api/architecture' : './data/project-architecture.json';
  const preferencesEndpoint = import.meta.env.DEV ? '/api/preferences' : './data/canvas-preferences.json';
  const architectureRepository = createHttpJsonRepository(
    architectureEndpoint, architectureDocumentSchema, emptyArchitecture,
  );
  const preferencesRepository = createHttpJsonRepository(
    preferencesEndpoint, canvasPreferencesSchema, defaultPreferences,
  );
  let architecture;
  let preferences;
  try {
    [architecture, preferences] = await Promise.all([
      architectureRepository.load(), preferencesRepository.load(),
    ]);
  } catch (error) {
    // Refuse to open rather than start on an empty document: the autosave that follows would
    // write that emptiness over whatever is actually on disk.
    root.render(<StrictMode><LoadFailure detail={error instanceof Error ? error.message : String(error)} /></StrictMode>);
    return;
  }
  const engine = createCanvasEngine(architecture, architectureRepository);

  // External writers (the canvas CLI) touch the data files directly; the dev
  // bridge notifies us so the open canvas reflects disk without a manual reload.
  if (import.meta.hot) {
    import.meta.hot.on('novakai:data-changed', () => {
      void engine.reload();
    });
  }

  root.render(
    <StrictMode>
      <App engine={engine} initialPreferences={preferences} preferencesRepository={preferencesRepository} />
    </StrictMode>,
  );
}

void (workSessionReport ? bootstrapWorkSessionReport() : bootstrapCanvas());
