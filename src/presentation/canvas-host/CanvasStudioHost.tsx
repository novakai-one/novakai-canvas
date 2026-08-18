import { useEffect, useMemo, useState } from 'react';
import App, { type AppProps } from '../../App';
import { createFileLibraryRepository, createCanvasLibrary, type ActorContext } from '../../canvas';
import { createHttpJsonRepository } from '../../adapters/http-json-repository';
import { canvasPreferencesSchema } from '../../domain/schema';
import { defaultPreferences } from '../../domain/defaults';
import { LoadFailure } from '../components/load-failure';
import { CanvasActivityProvider } from '../shell/canvas-activity-provider';
import '@xyflow/react/dist/style.css';
import '../../styles.css';
import './canvas-studio-host.css';

/** The only fact a host supplies: who its Canvas changes are attributed to. */
export interface CanvasStudioHostProps {
  actor: ActorContext;
  /** Whether this mounted studio currently owns visible host interaction. */
  active?: boolean;
}

type CanvasStudioSession = AppProps;

type HostState =
  | { status: 'loading' }
  | { status: 'ready'; session: CanvasStudioSession; generation: number }
  | { status: 'failed'; detail: string };

/*
 * React StrictMode mounts effects twice in development. Share only work that is currently in
 * flight so an empty library cannot mint two first diagrams; completed sessions are not cached,
 * so leaving and re-entering the Room reads persisted preferences and records again.
 */
const inFlightSessions = new Map<string, Promise<CanvasStudioSession>>();

function actorKey(context: ActorContext): string {
  return [
    context.actor.kind,
    context.actor.id,
    context.provenance.source,
    context.provenance.sourceRef ?? '',
  ].join(':');
}

async function createSession(actor: ActorContext): Promise<CanvasStudioSession> {
  const preferencesEndpoint = import.meta.env.DEV
    ? '/api/preferences'
    : './data/canvas-preferences.json';
  const preferencesRepository = createHttpJsonRepository(
    preferencesEndpoint,
    canvasPreferencesSchema,
    defaultPreferences,
  );
  const repository = createFileLibraryRepository();
  const [index, preferences] = await Promise.all([
    repository.readIndex(),
    preferencesRepository.load(),
  ]);
  const library = createCanvasLibrary(repository, index, actor);

  // The first-run case is the sole load path that writes, and it cannot overwrite a record.
  const first = library.list().at(0)
    ?? await library.create('Untitled diagram', `diagram-${crypto.randomUUID().slice(0, 8)}`);
  if (!('nodeLabels' in first)) throw new Error(`library-unusable:${first.status}`);
  const workspace = await library.open(first.id);
  if (!('snapshot' in workspace)) throw new Error(`diagram-unreadable:${workspace.status}`);

  return {
    initialDiagramId: first.id,
    initialPreferences: preferences,
    initialWorkspace: workspace,
    library,
    preferencesRepository,
  };
}

function loadSession(actor: ActorContext): Promise<CanvasStudioSession> {
  const key = actorKey(actor);
  const existing = inFlightSessions.get(key);
  if (existing) return existing;
  const loading = createSession(actor).finally(() => inFlightSessions.delete(key));
  inFlightSessions.set(key, loading);
  return loading;
}

function ExternalChangeNotice({ reload }: { reload: () => void }) {
  return (
    <div className="canvas-host__external-change" role="status">
      <span>Canvas changed on disk.</span>
      <button type="button" onClick={reload}>Reload Canvas</button>
    </div>
  );
}

/**
 * Composes and renders the same Canvas studio for standalone and embedded hosts.
 *
 * Loading failures stay visible and inert. External file changes are announced, never applied
 * automatically: the person decides when replacing the current in-memory session is safe.
 */
export function CanvasStudioHost({ active = true, actor }: CanvasStudioHostProps) {
  const [reload, setReload] = useState(0);
  const [externalChange, setExternalChange] = useState(false);
  const [state, setState] = useState<HostState>({ status: 'loading' });
  const stableActor = useMemo<ActorContext>(() => ({
    actor: { id: actor.actor.id, kind: actor.actor.kind },
    provenance: {
      source: actor.provenance.source,
      ...(actor.provenance.sourceRef ? { sourceRef: actor.provenance.sourceRef } : {}),
    },
  }), [
    actor.actor.id,
    actor.actor.kind,
    actor.provenance.source,
    actor.provenance.sourceRef,
  ]);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void loadSession(stableActor).then(
      (session) => {
        if (active) setState({ status: 'ready', session, generation: reload });
      },
      (error: unknown) => {
        if (active) {
          setState({
            status: 'failed',
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
    return () => { active = false; };
  }, [reload, stableActor]);

  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const onDataChanged = () => setExternalChange(true);
    hot.on('novakai:data-changed', onDataChanged);
    return () => hot.off('novakai:data-changed', onDataChanged);
  }, []);

  return (
    <CanvasActivityProvider active={active}>
      <section className="canvas-host" aria-label="Canvas studio">
        {externalChange && (
          <ExternalChangeNotice reload={() => {
            setExternalChange(false);
            setReload((current) => current + 1);
          }} />
        )}
        {state.status === 'loading' && (
          <main className="canvas-host__state" role="status">Loading Canvas…</main>
        )}
        {state.status === 'failed' && <LoadFailure detail={state.detail} />}
        {state.status === 'ready' && <App key={state.generation} {...state.session} />}
      </section>
    </CanvasActivityProvider>
  );
}
