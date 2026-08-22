import type { ContainerArrangement } from '../../../src/domain/canvas-presentation.ts';
import type { PlacedNode } from '../record-graph.ts';

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
  nodes: Record<string, PlacedNode>,
  containerId: string | undefined,
  arrangement?: ContainerArrangement,
): PlacedNode[] {
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
