import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root')!);
const workSessionPrototype = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('prototype') === 'work-session-report';

async function bootstrapWorkSessionPrototype(): Promise<void> {
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
        Loading work-session report prototype…
      </main>
    </StrictMode>,
  );
  const { WorkSessionReportPrototype } = await import(
    './presentation/prototypes/work-session-report/WorkSessionReportPrototype'
  );
  root.render(
    <StrictMode>
      <WorkSessionReportPrototype />
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
  const [architecture, preferences] = await Promise.all([
    architectureRepository.load(), preferencesRepository.load(),
  ]);
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

void (workSessionPrototype ? bootstrapWorkSessionPrototype() : bootstrapCanvas());
