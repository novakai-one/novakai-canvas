/** Cross-diagram read context and apply-time link reconciliation. */

import type { CanvasLibrary, CrossDiagramLink, DiagramRecord } from '../../src/canvas.ts';
import type { CrossDiagramWire } from './compile.ts';
import type { CrossDiagramContext } from './dsl-print.ts';
import { asId } from './record-graph.ts';

export function crossDiagramContext(
  records: Record<string, DiagramRecord>,
  links: CrossDiagramLink[],
): CrossDiagramContext {
  return { links, labelOf: (diagramId, nodeId) => records[diagramId]?.nodes[nodeId]?.label };
}

function linkIdFor(existing: CrossDiagramLink[], wire: CrossDiagramWire): string {
  const already = existing.find((link) =>
    link.source.nodeId === wire.source.nodeId && link.target.nodeId === wire.target.nodeId);
  return (already?.id as string | undefined) ?? `${wire.source.nodeId}--to--${wire.target.nodeId}`;
}

/** Stores declared cross-map links and removes links made dangling by the same apply. */
export async function reconcileLinks(
  library: CanvasLibrary,
  records: Record<string, DiagramRecord>,
  appliedDiagramIds: Set<string>,
  declared: CrossDiagramWire[],
): Promise<string[]> {
  const notes: string[] = [];
  const before = Object.values(library.index().links);
  const keep = new Set<string>();
  for (const wire of declared) {
    const id = linkIdFor(before, wire);
    keep.add(id);
    const outcome = await library.addLink({
      id: asId(id),
      kind: wire.kind,
      label: wire.label,
      source: { diagramId: asId(wire.source.diagramId), nodeId: asId(wire.source.nodeId) },
      target: { diagramId: asId(wire.target.diagramId), nodeId: asId(wire.target.nodeId) },
    });
    if ('status' in outcome) notes.push(`cross-map link ${id} not stored: ${outcome.status}`);
    else notes.push(`cross-map link: ${wire.source.nodeId} -> ${wire.target.diagramId}/${wire.target.nodeId}`);
  }
  for (const link of before) {
    if (keep.has(link.id as string)) continue;
    const dangling = [link.source, link.target].some((end) =>
      appliedDiagramIds.has(end.diagramId as string) && !records[end.diagramId]?.nodes[end.nodeId]);
    if (!dangling) continue;
    await library.removeLink(link.id as string);
    notes.push(`dropped cross-map link ${link.id}: its endpoint no longer exists`);
  }
  return notes;
}
