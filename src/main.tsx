import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ActorContext } from './application/canvas-workspace';
import './styles/standalone.css';

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

async function bootstrapCanvas(): Promise<void> {
  // CanvasStudioHost owns the former import('./App') composition behind one shared host seam.
  const { CanvasStudioHost } = await import(
    './presentation/canvas-host/CanvasStudioHost'
  );
  root.render(<StrictMode><CanvasStudioHost actor={LOCAL_USER} /></StrictMode>);
}

void (workSessionReport ? bootstrapWorkSessionReport() : bootstrapCanvas());
