import type { ContainerArrangement } from '../../contract/schemas/presentation.ts';
import type { CanvasNode, DiagramRecord } from '../../contract/records/index.ts';

/** One semantic node joined with the active layout position used only for stable ordering. */
export interface ExportNode extends CanvasNode {
  position: { x: number; y: number };
}

/** Double-quotes one DSL value. */
export function quote(value: string): string {
  return `"${value}"`;
}

/** Orders generated wires numerically, with lexical order for authored or legacy ids. */
export function byWireOrder(left: string, right: string): number {
  const index = (id: string): number => {
    const match = /--wire-(\d+)$/.exec(id);
    return match ? Number(match[1]) : Number.NaN;
  };
  const leftIndex = index(left);
  const rightIndex = index(right);
  if (Number.isNaN(leftIndex) || Number.isNaN(rightIndex)) return left.localeCompare(right);
  return leftIndex - rightIndex;
}

/** Returns direct children in authored arrangement order, then stable geometric order. */
export function childrenOf(
  nodes: Readonly<Record<string, ExportNode>>,
  containerId: string | undefined,
  arrangement?: ContainerArrangement,
): ExportNode[] {
  const children = Object.values(nodes)
    .filter((node) => (node.parentId as string | undefined) === containerId)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x
      || (a.id as string).localeCompare(b.id as string));
  if (!arrangement) return children;
  const byId = new Map(children.map((node) => [node.id as string, node]));
  const emitted = new Set<string>();
  const authored = arrangement.childIds.flatMap((id) => {
    const child = byId.get(id);
    if (!child || emitted.has(id)) return [];
    emitted.add(id);
    return [child];
  });
  return [...authored, ...children.filter((node) => !emitted.has(node.id as string))];
}

/** Every record node joined with its active-layout position. */
export function exportNodes(record: DiagramRecord): Record<string, ExportNode> {
  const view = record.views[record.activeViewId];
  const placements = record.layouts[view.layoutId]?.placements ?? {};
  return Object.fromEntries(Object.entries(record.nodes).map(([id, node]) => [id, {
    ...node,
    position: placements[id]?.position ?? { x: 0, y: 0 },
  }]));
}

/** The sole root scope when one exists; malformed or rootless records return undefined. */
export function rootGroupId(record: DiagramRecord): string | undefined {
  const roots = Object.values(record.nodes)
    .filter((node) => node.kind === 'group' && !node.parentId);
  return roots.length === 1 ? roots[0].id as string : undefined;
}

/** Canonical arrangement order is layout, columns, gap, align. */
export function arrangementAttributes(arrangement: ContainerArrangement | undefined): string[] {
  if (!arrangement) return [];
  return [
    `layout=${arrangement.layout}`,
    ...(arrangement.columns === undefined ? [] : [`columns=${arrangement.columns}`]),
    `gap=${arrangement.gap}`,
    ...(arrangement.align === 'stretch' ? [] : [`align=${arrangement.align}`]),
  ];
}
