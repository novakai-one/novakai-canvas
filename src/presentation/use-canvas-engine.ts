import { useSyncExternalStore } from 'react';
import type { CanvasEngine } from '../application/canvas-engine';

/** Subscribes React to the framework-free canvas engine. */
export function useCanvasEngine(engine: CanvasEngine) {
  return useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
}
