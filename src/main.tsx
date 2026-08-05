import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LoadFailure } from './presentation/components/load-failure';
import type { DiagramSummary } from './application/canvas-library';

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

  const libraryDiagrams = await loadLibraryDiagrams();

  root.render(
    <StrictMode>
      <App
        engine={engine}
        initialPreferences={preferences}
        libraryDiagrams={libraryDiagrams}
        preferencesRepository={preferencesRepository}
      />
    </StrictMode>,
  );
}

/**
 * Builds the v3 record-model library and snapshots its diagram list for the picker.
 *
 * Dev-only: the endpoints this needs (`/api/library`, `/api/diagrams`) are served by the Vite
 * dev bridge, which does not exist in a static production build — there the picker keeps sourcing
 * from the legacy document exactly as it does today. A failure here is logged, not thrown: the
 * library is an additive read path proving the record-model seam, not yet load-bearing for
 * rendering, so it must never take the whole app down.
 */
async function loadLibraryDiagrams(): Promise<DiagramSummary[] | undefined> {
  if (!import.meta.env.DEV) return undefined;
  try {
    const [{ createFileLibraryRepository }, { createCanvasLibrary }] = await Promise.all([
      import('./adapters/file-library-repository'),
      import('./application/canvas-library'),
    ]);
    const repository = createFileLibraryRepository();
    const index = await repository.readIndex();
    const library = createCanvasLibrary(repository, index, {
      actor: { id: 'local-user', kind: 'human' },
      provenance: { source: 'ui' },
    });
    return library.list({ includeArchived: true });
  } catch (error) {
    console.error('[canvas library] unavailable; the diagram picker falls back to the legacy document', error);
    return undefined;
  }
}

void (workSessionReport ? bootstrapWorkSessionReport() : bootstrapCanvas());
