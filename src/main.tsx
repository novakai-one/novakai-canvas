import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ActorContext } from '@novakai/canvas';
import './styles/standalone.css';

/** Who this host acts as. Every change it submits carries this attribution, never a caller's. */
const LOCAL_USER: ActorContext = {
  actor: { id: 'local-user', kind: 'human' },
  provenance: { source: 'ui' },
};

const root = createRoot(document.getElementById('root')!);

async function bootstrapCanvas(): Promise<void> {
  // CanvasStudioHost owns the former import('./App') composition behind one shared host seam.
  const { CanvasStudioHost } = await import(
    './presentation/canvas-host/CanvasStudioHost'
  );
  root.render(<StrictMode><CanvasStudioHost actor={LOCAL_USER} /></StrictMode>);
}

void bootstrapCanvas();
