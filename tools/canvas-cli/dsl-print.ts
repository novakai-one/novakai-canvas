/** Prints records as canonical, round-trippable agent DSL. */

import type { CrossDiagramLink, DiagramRecord } from '../../src/canvas.ts';
import { placedNodes, rootGroupId } from './record-graph.ts';
import type { CrossDiagramContext, MapSummary } from './dsl-print/contract.ts';
import { printDeclarations } from './dsl-print/declarations.ts';
import { arrangementAttributes, byWireOrder, quote } from './dsl-print/ordering.ts';
import type { WireAppearance } from '../../src/domain/wire-appearance.ts';
import { printWireAttributes } from './wire-attributes.ts';
import type { WireCardinality } from '../../src/domain/wire-cardinality.ts';
import { printWireReference, wireReferenceFor } from './wire-reference.ts';

export type { CrossDiagramContext, MapSummary } from './dsl-print/contract.ts';

function wireLine(
  source: string,
  target: string,
  label: string,
  kind: string,
  appearance?: WireAppearance,
  sourceCardinality?: WireCardinality,
  targetCardinality?: WireCardinality,
): string {
  const attributes = printWireAttributes({ appearance, sourceCardinality, targetCardinality });
  return `  wire ${printWireReference(source)} -> ${printWireReference(target)}`
    + `${attributes.length ? ` ${attributes.join(' ')}` : ''} : ${label}`
    + `${kind === 'references' ? '' : ` [${kind}]`}`;
}

function printWires(record: DiagramRecord, context?: CrossDiagramContext): string[] {
  const lines: string[] = [];
  const layout = record.layouts[record.views[record.activeViewId]?.layoutId];
  for (const wire of Object.values(record.wires)
    .sort((a, b) => byWireOrder(a.id as string, b.id as string))) {
    const source = record.nodes[wire.source.nodeId];
    const target = record.nodes[wire.target.nodeId];
    if (!source || !target) continue;
    const sourceReference = wireReferenceFor(source);
    const targetReference = wireReferenceFor(target);
    if (!sourceReference || !targetReference) continue;
    lines.push(wireLine(
      sourceReference,
      targetReference,
      wire.label,
      wire.kind,
      layout?.appearanceByWireId?.[wire.id],
      wire.source.cardinality,
      wire.target.cardinality,
    ));
  }
  for (const link of (context?.links ?? [])
    .filter((link) => link.source.diagramId === record.id)
    .sort((a, b) => (a.id as string).localeCompare(b.id as string))) {
    const sourceNode = record.nodes[link.source.nodeId];
    const source = sourceNode ? wireReferenceFor(sourceNode) : undefined;
    const target = context?.referenceOf?.(
      link.target.diagramId as string, link.target.nodeId as string,
    ) ?? context?.labelOf(link.target.diagramId as string, link.target.nodeId as string);
    if (!source || !target) continue;
    lines.push(wireLine(
      source, target, link.label, link.kind, undefined,
      link.source.cardinality, link.target.cardinality,
    ));
  }
  return lines;
}

/** Prints one complete record, including nested declarations and outbound relationships. */
export function printRecord(record: DiagramRecord, context?: CrossDiagramContext): string {
  const nodes = placedNodes(record);
  const rootId = rootGroupId(record);
  const root = rootId ? nodes[rootId] : undefined;
  const layout = record.layouts[record.views[record.activeViewId]?.layoutId];
  const rootAttributes = arrangementAttributes(
    rootId ? layout?.arrangementByContainerId?.[rootId] : undefined,
  );
  const title = root?.label ?? record.name;
  const lines = [
    `scope ${quote(title)}${root?.description ? ` ${quote(root.description)}` : ''}`
      + `${rootAttributes.length ? ` ${rootAttributes.join(' ')}` : ''}`,
    ...printDeclarations(record, nodes, layout, rootId),
    ...printWires(record, context),
  ];
  return `${lines.join('\n')}\n`;
}

/** Every record as DSL, in library order. */
export function printLibrary(records: DiagramRecord[], context?: CrossDiagramContext): string {
  return records.map((record) => printRecord(record, context)).join('\n');
}

/** Lists maps in record order with their visible node and wire counts. */
export function listMaps(
  records: DiagramRecord[],
  links: CrossDiagramLink[] = [],
): MapSummary[] {
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
