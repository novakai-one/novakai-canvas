import { useSyncExternalStore } from 'react';
import type { CanvasEngine } from '../application/canvas-engine';

export function useCanvasEngine(engine: CanvasEngine) {
  return useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
}
