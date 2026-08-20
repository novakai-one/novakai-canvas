/** Prints a diagram record back as round-trippable DSL — the cheap way to reload context. */

import type { CrossDiagramLink, DiagramRecord } from '../../src/canvas.ts';
import { componentFor } from '../../src/components/registry.ts';
import { placedNodes, rootGroupId, type PlacedNode } from './record-graph.ts';
import { appearanceSpecification } from '../../src/domain/canvas-presentation.ts';

/**
 * What a printer needs to render a relationship whose far end is in another diagram.
 *
 * The DSL names endpoints by label, so printing a cross-diagram wire means resolving a label
 * that this record does not hold. The resolver is supplied rather than assumed, because reading
 * one diagram must never require another diagram to be readable.
 */
export interface CrossDiagramContext {
  links: CrossDiagramLink[];
  labelOf(diagramId: string, nodeId: string): string | undefined;
}

/** One map as the `maps` listing shows it. */
export interface MapSummary {
  id: string;
  label: string;
  nodes: number;
  wires: number;
}

function quote(label: string): string {
  return `"${label}"`;
}

/**
 * Orders wires by the counter in their generated id, falling back to plain text order.
 *
 * A plain string sort puts `wire-10` before `wire-2`, which makes a printed map's wire order
 * flip the first time a map grows past nine wires — and a print that changes without the map
 * changing is not a round trip.
 */
function byWireOrder(left: string, right: string): number {
  const index = (id: string): number => {
    const match = /--wire-(\d+)$/.exec(id);
    return match ? Number(match[1]) : Number.NaN;
  };
  const leftIndex = index(left);
  const rightIndex = index(right);
  if (Number.isNaN(leftIndex) || Number.isNaN(rightIndex)) return left.localeCompare(right);
  return leftIndex - rightIndex;
}

function childrenOf(nodes: Record<string, PlacedNode>, containerId: string | undefined): PlacedNode[] {
  return Object.values(nodes)
    .filter((node) => (node.parentId as string | undefined) === containerId)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x
      || (a.id as string).localeCompare(b.id as string));
}

/**
 * One record as DSL. Nested groups print as zone/end blocks, round-trippable through `apply`.
 *
 * Cross-diagram links whose source is in this record print as ordinary wires: that is how the
 * DSL declared them, and leaving them out would make `read` a lossy view of the map.
 */
export function printRecord(record: DiagramRecord, context?: CrossDiagramContext): string {
  const nodes = placedNodes(record);
  const rootId = rootGroupId(record);
  const root = rootId ? nodes[rootId] : undefined;
  const lines: string[] = [];
  const title = root?.label ?? record.name;
  lines.push(`scope ${quote(title)}${root?.description ? ` ${quote(root.description)}` : ''}`);
  const activeLayout = record.layouts[record.views[record.activeViewId]?.layoutId];

  const emitContainer = (containerId: string | undefined, indent: string): void => {
    for (const node of childrenOf(nodes, containerId)) {
      const component = componentFor(node.kind);
      const authored = activeLayout?.appearanceByNodeId?.[node.id];
      const attributes = (component.appearanceKeys ?? []).flatMap((key) => {
        const specification = appearanceSpecification(key);
        const value = authored?.[specification.jsonKey];
        return value === undefined ? [] : [`${key}=${String(value)}`];
      });
      const declaration = `${indent}${component.declaration.print(node)}${attributes.length ? ` ${attributes.join(' ')}` : ''}`;
      if (component.layoutRole === 'container') {
        lines.push(declaration);
        emitContainer(node.id as string, `${indent}  `);
        lines.push(`${indent}end`);
        continue;
      }
      lines.push(declaration);
      for (const interfaceId of node.interfaceIds) {
        const method = record.interfaces[interfaceId];
        if (!method) continue;
        lines.push(`${indent}  ${method.name}(${method.accepts.join(', ')}) -> ${method.returns.join(', ')}`);
      }
      for (const typeId of node.typeIds) {
        const type = record.types[typeId];
        if (!type) continue;
        lines.push(`${indent}  type ${type.name} { ${type.fields.join(', ')} }`);
      }
      // Child lines (tree's `row`) are printed by the component that owns them, already
      // 2-space indented relative to their node statement.
      for (const statement of component.dslChildren ?? []) {
        for (const childLine of statement.print(node)) lines.push(`${indent}${childLine}`);
      }
    }
  };
  emitContainer(rootId, '  ');

  const wireLine = (sourceLabel: string, targetLabel: string, label: string, kind: string): string =>
    `  wire ${quote(sourceLabel)} -> ${quote(targetLabel)} : ${label}${kind === 'references' ? '' : ` [${kind}]`}`;

  for (const wire of Object.values(record.wires)
    .sort((a, b) => byWireOrder(a.id as string, b.id as string))) {
    const source = record.nodes[wire.source.nodeId];
    const target = record.nodes[wire.target.nodeId];
    if (!source || !target) continue;
    lines.push(wireLine(source.label, target.label, wire.label, wire.kind));
  }

  for (const link of (context?.links ?? [])
    .filter((link) => link.source.diagramId === record.id)
    .sort((a, b) => (a.id as string).localeCompare(b.id as string))) {
    const sourceLabel = record.nodes[link.source.nodeId]?.label;
    const targetLabel = context?.labelOf(link.target.diagramId as string, link.target.nodeId as string);
    if (!sourceLabel || !targetLabel) continue;
    lines.push(wireLine(sourceLabel, targetLabel, link.label, link.kind));
  }

  return `${lines.join('\n')}\n`;
}

/** Every record as DSL, in library order. */
export function printLibrary(records: DiagramRecord[], context?: CrossDiagramContext): string {
  return records.map((record) => printRecord(record, context)).join('\n');
}

/** Maps with their content counts; a cross-diagram link counts as a wire of its source map. */
export function listMaps(records: DiagramRecord[], links: CrossDiagramLink[] = []): MapSummary[] {
  return records.map((record) => {
    const rootId = rootGroupId(record);
    const outbound = links.filter((link) => link.source.diagramId === record.id).length;
    return {
      id: record.id as string,
      label: (rootId ? record.nodes[rootId]?.label : undefined) ?? record.name,
      nodes: Object.keys(record.nodes).length - (rootId ? 1 : 0),
      wires: Object.keys(record.wires).length + outbound,
    };
  });
}
