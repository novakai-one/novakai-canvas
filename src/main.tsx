import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import App from './App';
import { createCanvasEngine } from './application/canvas-engine';
import { createHttpJsonRepository } from './adapters/http-json-repository';
import { architectureDocumentSchema, canvasPreferencesSchema } from './domain/schema';
import { defaultPreferences, emptyArchitecture } from './domain/defaults';
import './styles.css';

async function bootstrap(): Promise<void> {
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

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App engine={engine} initialPreferences={preferences} preferencesRepository={preferencesRepository} />
    </StrictMode>,
  );
}

void bootstrap();
