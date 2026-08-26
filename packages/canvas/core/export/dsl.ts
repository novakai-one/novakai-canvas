/** Prints records as canonical, round-trippable agent DSL. */

import {
  printWireReference, wireReferenceFor, wireReferenceForEndpoint,
} from '../authoring/wire-reference.ts';
import type { DiagramRecord } from '../../contract/records/index.ts';
import {
  WIRE_APPEARANCE_SPECIFICATIONS, type WireAppearance,
} from '../../contract/schemas/wire-appearance.ts';
import type { WireCardinality } from '../../contract/schemas/wire-cardinality.ts';
import type { DiagramExportContext } from './contract.ts';
import { printDeclarations } from './declarations.ts';
import {
  arrangementAttributes, byWireOrder, exportNodes, quote, rootGroupId,
} from './ordering.ts';
import { compileFlows, stepsOf } from '../domain/flows.ts';
import { slugify } from '../authoring/slug.ts';

const CARDINALITY_ATTRIBUTES = [
  { key: 'source-cardinality', field: 'sourceCardinality' },
  { key: 'target-cardinality', field: 'targetCardinality' },
] as const;

function printWireAttributes(attributes: {
  sourceCardinality?: WireCardinality;
  targetCardinality?: WireCardinality;
  appearance?: WireAppearance;
}): string[] {
  return [
    ...CARDINALITY_ATTRIBUTES.flatMap((entry) => {
      const value = attributes[entry.field];
      return value === undefined ? [] : [`${entry.key}=${value}`];
    }),
    ...WIRE_APPEARANCE_SPECIFICATIONS.flatMap((entry) => {
      const value = attributes.appearance?.[entry.key];
      return value === undefined ? [] : [`${entry.key}=${value}`];
    }),
  ];
}

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

function printWires(record: DiagramRecord, context: DiagramExportContext): string[] {
  const lines: string[] = [];
  const layout = record.layouts[record.views[record.activeViewId]?.layoutId];
  for (const wire of Object.values(record.wires)
    .sort((a, b) => byWireOrder(a.id as string, b.id as string))) {
    const source = record.nodes[wire.source.nodeId];
    const target = record.nodes[wire.target.nodeId];
    if (!source || !target) throw new Error(`diagram-export-missing-wire-end:${wire.id}`);
    const sourceReference = wireReferenceForEndpoint(record, wire.source);
    const targetReference = wireReferenceForEndpoint(record, wire.target);
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
  for (const link of context.links
    .filter((link) => link.source.diagramId === record.id)
    .sort((a, b) => (a.id as string).localeCompare(b.id as string))) {
    const sourceNode = record.nodes[link.source.nodeId];
    const source = sourceNode ? wireReferenceFor(sourceNode) : undefined;
    const targetNode = context.records[link.target.diagramId]?.nodes[link.target.nodeId];
    const target = targetNode ? wireReferenceFor(targetNode) : undefined;
    if (!source || !target) throw new Error(`diagram-export-missing-link-end:${link.id}`);
    lines.push(wireLine(
      source, target, link.label, link.kind, undefined,
      link.source.cardinality, link.target.cardinality,
    ));
  }
  return lines;
}

function printFlows(record: DiagramRecord, rootId: string | undefined): string[] {
  const lines: string[] = [];
  for (const [id, flow] of compileFlows(record)) {
    const generated = `${rootId ?? record.id}--flow-${slugify(flow.name)}`;
    lines.push(`  flow ${quote(flow.name)}${id === generated ? '' : ` id=${quote(id)}`}`);
    for (const step of stepsOf(flow)) lines.push(`    step ${step.ordinal} ${quote(step.ref)}`);
    lines.push('  end');
  }
  return lines;
}

/** Prints one complete record, including nested declarations and outbound relationships. */
export function printRecord(record: DiagramRecord, context: DiagramExportContext): string {
  const nodes = exportNodes(record);
  const rootId = rootGroupId(record);
  const root = rootId ? nodes[rootId] : undefined;
  const layout = record.layouts[record.views[record.activeViewId]?.layoutId];
  const rootAttributes = [
    ...arrangementAttributes(rootId ? layout?.arrangementByContainerId?.[rootId] : undefined),
    // Printed only when declared: writing the default would rewrite every existing map.
    ...(record.orientation === undefined ? [] : [`orientation=${record.orientation}`]),
  ];
  const title = root?.label ?? record.name;
  const lines = [
    `scope ${quote(title)}${root?.description ? ` ${quote(root.description)}` : ''}`
      + `${rootAttributes.length ? ` ${rootAttributes.join(' ')}` : ''}`,
    ...printDeclarations(record, nodes, layout, rootId),
    ...printWires(record, context),
    ...printFlows(record, rootId),
  ];
  return `${lines.join('\n')}\n`;
}

/** Every record as DSL, in library order. */
export function printLibrary(
  records: readonly DiagramRecord[],
  context: DiagramExportContext,
): string {
  return records.map((record) => printRecord(record, context)).join('\n');
}
