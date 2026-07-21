import type { ArchitectureDocument, CanvasNode } from '../domain/model';

/** Builds a new child for the active map; ID generation remains at the UI edge. */
export function createCanvasNode(
  document: ArchitectureDocument,
  parentId: string,
  kind: 'module' | 'comment',
  id: string,
): CanvasNode {
  const count = Object.values(document.nodes).filter((node) => node.parentId === parentId).length;
  return {
    id,
    kind,
    label: kind === 'comment' ? 'Add context here' : 'New module',
    position: kind === 'comment'
      ? { x: 40 + (count % 3) * 300, y: 80 + (count % 4) * 140 }
      : { x: 60 + (count % 3) * 240, y: 120 + (count % 4) * 160 },
    size: kind === 'comment' ? { width: 240, height: 100 } : { width: 200, height: 110 },
    parentId,
    interfaceIds: [],
    typeIds: [],
  };
}
