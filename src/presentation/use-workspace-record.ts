import { useCallback, useSyncExternalStore } from 'react';
import type { CanvasWorkspace } from '@novakai/canvas';
import type { DiagramRecord } from '@novakai/canvas';

/**
 * Subscribes React to one framework-free workspace.
 *
 * The workspace replaces its record on every applied change and keeps the same object otherwise,
 * which is exactly the identity contract `useSyncExternalStore` needs, so no copy is made here.
 */
export function useWorkspaceRecord(workspace: CanvasWorkspace): DiagramRecord {
  const subscribe = useCallback((listener: () => void) => workspace.subscribe(listener), [workspace]);
  const snapshot = useCallback(() => workspace.snapshot(), [workspace]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
