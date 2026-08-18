import { lazy, Suspense } from 'react';
import type { ActorContext } from '../../../../application/canvas-workspace';
import './canvas-room.css';

const CanvasStudioHost = lazy(async () => {
  const module = await import('../../../canvas-host/CanvasStudioHost');
  return { default: module.CanvasStudioHost };
});

/** Attribution supplied by the prototype host; Canvas owns every other session dependency. */
const PROTOTYPE_ACTOR: ActorContext = {
  actor: { id: 'local-user', kind: 'human' },
  provenance: { source: 'ui', sourceRef: 'prototype:canvas-room' },
};

/** The production Canvas capability mounted as a first-class prototype Room. */
export function CanvasRoom() {
  return (
    <section className="canvas-room" aria-label="Canvas Room">
      <Suspense fallback={<main className="canvas-room__loading" role="status">Loading Canvas…</main>}>
        <CanvasStudioHost actor={PROTOTYPE_ACTOR} />
      </Suspense>
    </section>
  );
}
