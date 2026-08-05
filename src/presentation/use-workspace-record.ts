import { useSyncExternalStore } from 'react';
import type { CanvasWorkspace } from '../application/canvas-workspace';
import type { DiagramRecord } from '../domain/records';

/**
 * Subscribes React to one framework-free workspace.
 *
 * The workspace replaces its record on every applied change and keeps the same object otherwise,
 * which is exactly the identity contract `useSyncExternalStore` needs, so no copy is made here.
 */
export function useWorkspaceRecord(workspace: CanvasWorkspace): DiagramRecord {
  return useSyncExternalStore(workspace.subscribe, workspace.snapshot, workspace.snapshot);
}
