import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LoadFailure } from './presentation/components/load-failure';
import type { ActorContext } from './application/canvas-workspace';

/** Who this host acts as. Every change it submits carries this attribution, never a caller's. */
const LOCAL_USER: ActorContext = {
  actor: { id: 'local-user', kind: 'human' },
  provenance: { source: 'ui' },
};

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

/**
 * Composes the record-model canvas: repository → library → one open diagram → render.
 *
 * Nothing is written on the way in. If the index, the first record, or the preferences cannot be
 * read, the app refuses to open rather than starting on an empty diagram — the autosave that
 * follows would write that emptiness over whatever is actually on disk.
 */
async function bootstrapCanvas(): Promise<void> {
  const [
    { default: App },
    { createFileLibraryRepository },
    { createCanvasLibrary },
    { createHttpJsonRepository },
    { canvasPreferencesSchema },
    { defaultPreferences },
  ] = await Promise.all([
    import('./App'),
    import('./adapters/file-library-repository'),
    import('./application/canvas-library'),
    import('./adapters/http-json-repository'),
    import('./domain/schema'),
    import('./domain/defaults'),
    import('@xyflow/react/dist/style.css'),
    import('./styles.css'),
  ]);
  const preferencesEndpoint = import.meta.env.DEV ? '/api/preferences' : './data/canvas-preferences.json';
  const preferencesRepository = createHttpJsonRepository(
    preferencesEndpoint, canvasPreferencesSchema, defaultPreferences,
  );

  try {
    const repository = createFileLibraryRepository();
    const [index, preferences] = await Promise.all([
      repository.readIndex(), preferencesRepository.load(),
    ]);
    const library = createCanvasLibrary(repository, index, LOCAL_USER);
    // A library with nothing in it is the first-run case, not a failure: creating the first
    // diagram is the only write this path makes, and it overwrites nothing.
    const first = library.list().at(0)
      ?? await library.create('Untitled diagram', `diagram-${crypto.randomUUID().slice(0, 8)}`);
    if (!('nodeLabels' in first)) throw new Error(`library-unusable:${first.status}`);
    const workspace = await library.open(first.id);
    if (!('snapshot' in workspace)) throw new Error(`diagram-unreadable:${workspace.status}`);

    root.render(
      <StrictMode>
        <App
          initialDiagramId={first.id}
          initialPreferences={preferences}
          initialWorkspace={workspace}
          library={library}
          preferencesRepository={preferencesRepository}
        />
      </StrictMode>,
    );
  } catch (error) {
    root.render(<StrictMode><LoadFailure detail={error instanceof Error ? error.message : String(error)} /></StrictMode>);
  }
}

void (workSessionReport ? bootstrapWorkSessionReport() : bootstrapCanvas());
