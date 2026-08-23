/** Compact, read-only Markdown projection of diagram semantics. */

import { wireReferenceFor } from '../authoring/wire-reference.ts';
import { componentFor } from '../components/registry.ts';
import type { CanvasNode, CrossDiagramLink, DiagramRecord } from '../domain/records.ts';
import type { DiagramExportContext } from './contract.ts';
import {
  byWireOrder, childrenOf, exportNodes, rootGroupId, type ExportNode,
} from './ordering.ts';

type Row = readonly string[];

function cell(value: string | undefined): string {
  if (!value) return '—';
  return value.replaceAll('|', '\\|').replaceAll(/\r?\n/g, '<br>');
}

function table(headers: readonly string[], rows: readonly Row[]): string[] {
  if (rows.length === 0) return [];
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
}

function addressFor(node: CanvasNode): string {
  return wireReferenceFor(node) ?? `#${node.id}`;
}

function linkedAddress(
  context: DiagramExportContext,
  diagramId: string,
  nodeId: string,
): string {
  const node = context.records[diagramId]?.nodes[nodeId];
  if (!node) throw new Error(`diagram-export-missing-node:${diagramId}/${nodeId}`);
  return `${diagramId}/${addressFor(node)}`;
}

function orderedNodes(record: DiagramRecord): ExportNode[] {
  const nodes = exportNodes(record);
  const rootId = rootGroupId(record);
  const layout = record.layouts[record.views[record.activeViewId].layoutId];
  const emitted = new Set<string>(rootId ? [rootId] : []);
  const descend = (parentId: string | undefined): ExportNode[] => {
    const arrangement = parentId
      ? layout.arrangementByContainerId?.[parentId] : undefined;
    return childrenOf(nodes, parentId, arrangement).flatMap((node) => {
      if (emitted.has(node.id as string)) return [];
      emitted.add(node.id as string);
      return [
        node,
        ...(componentFor(node.kind).layoutRole === 'container'
          ? descend(node.id as string) : []),
      ];
    });
  };
  const ordered = descend(rootId);
  const remaining = Object.values(nodes)
    .filter((node) => !emitted.has(node.id as string))
    .sort((left, right) => left.position.y - right.position.y
      || left.position.x - right.position.x
      || (left.id as string).localeCompare(right.id as string));
  const visit = (node: ExportNode): ExportNode[] => {
    if (emitted.has(node.id as string)) return [];
    const parent = node.parentId ? nodes[node.parentId] : undefined;
    const prefix = parent ? visit(parent) : [];
    emitted.add(node.id as string);
    return [
      ...prefix,
      node,
      ...(componentFor(node.kind).layoutRole === 'container'
        ? descend(node.id as string) : []),
    ];
  };
  return [...ordered, ...remaining.flatMap(visit)].filter((node) => node.id !== rootId);
}

function objectRows(record: DiagramRecord, nodes: readonly ExportNode[]): Row[] {
  const rootId = rootGroupId(record);
  return nodes.map((node) => {
    const parent = node.parentId && node.parentId !== rootId
      ? record.nodes[node.parentId] : undefined;
    return [
      addressFor(node),
      node.kind,
      parent ? addressFor(parent) : '—',
      componentFor(node.kind).declaration.print(node),
    ];
  });
}

function memberRows(record: DiagramRecord, nodes: readonly ExportNode[]): Row[] {
  return nodes.flatMap((node): Row[] => {
    const owner = addressFor(node);
    const rows: Row[] = [];
    for (const interfaceId of node.interfaceIds) {
      const method = record.interfaces[interfaceId];
      if (!method) throw new Error(`diagram-export-missing-interface:${interfaceId}`);
      rows.push([
        owner,
        'method',
        `${method.name}(${method.accepts.join(', ')}) -> ${method.returns.join(', ')}`,
      ]);
    }
    for (const typeId of node.typeIds) {
      const type = record.types[typeId];
      if (!type) throw new Error(`diagram-export-missing-type:${typeId}`);
      rows.push([owner, 'type', `type ${type.name} { ${type.fields.join(', ')} }`]);
    }
    for (const statement of componentFor(node.kind).dslChildren ?? []) {
      for (const printed of statement.print(node)) {
        const definition = printed.trim();
        rows.push([owner, definition.split(/\s+/, 1)[0] || statement.keyword, definition]);
      }
    }
    return rows;
  });
}

function localRelationshipRows(record: DiagramRecord): Row[] {
  return Object.values(record.wires)
    .sort((left, right) => byWireOrder(left.id as string, right.id as string))
    .map((wire): Row => {
      const source = record.nodes[wire.source.nodeId];
      const target = record.nodes[wire.target.nodeId];
      if (!source || !target) throw new Error(`diagram-export-missing-wire-end:${wire.id}`);
      return [
        addressFor(source), addressFor(target), wire.kind, wire.label,
        wire.source.cardinality ?? '—', wire.target.cardinality ?? '—',
      ];
    });
}

function ownsLinkInReport(
  link: CrossDiagramLink,
  recordId: string,
  selected: ReadonlySet<string>,
): boolean {
  if (link.source.diagramId === recordId) return true;
  return link.target.diagramId === recordId && !selected.has(link.source.diagramId as string);
}

function crossRelationshipRows(
  record: DiagramRecord,
  selected: ReadonlySet<string>,
  context: DiagramExportContext,
): Row[] {
  return context.links
    .filter((link) => ownsLinkInReport(link, record.id as string, selected))
    .sort((left, right) => (left.id as string).localeCompare(right.id as string))
    .map((link): Row => {
      const localSource = link.source.diagramId === record.id
        ? record.nodes[link.source.nodeId] : undefined;
      const localTarget = link.target.diagramId === record.id
        ? record.nodes[link.target.nodeId] : undefined;
      const source = localSource
        ? addressFor(localSource)
        : linkedAddress(context, link.source.diagramId as string, link.source.nodeId as string);
      const target = localTarget
        ? addressFor(localTarget)
        : linkedAddress(context, link.target.diagramId as string, link.target.nodeId as string);
      return [
        source, target, link.kind, link.label,
        link.source.cardinality ?? '—', link.target.cardinality ?? '—',
      ];
    });
}

function report(
  record: DiagramRecord,
  selected: ReadonlySet<string>,
  context: DiagramExportContext,
): string {
  const nodes = orderedNodes(record);
  const sections: string[] = [
    `# ${record.name}`,
    '',
    `Diagram: \`${record.id}\``,
  ];
  const objects = table(
    ['Address', 'Kind', 'Parent', 'Definition'],
    objectRows(record, nodes),
  );
  if (objects.length > 0) sections.push('', '## Objects', '', ...objects);
  const members = table(['Object', 'Member', 'Definition'], memberRows(record, nodes));
  if (members.length > 0) sections.push('', '## Members', '', ...members);
  const relationships = table(
    ['From', 'To', 'Kind', 'Contract', 'Source cardinality', 'Target cardinality'],
    [...localRelationshipRows(record), ...crossRelationshipRows(record, selected, context)],
  );
  if (relationships.length > 0) sections.push('', '## Relationships', '', ...relationships);
  return sections.join('\n');
}

/** Prints selected records as compact semantic reports, with each cross-map link exactly once. */
export function printMarkdown(
  records: readonly DiagramRecord[],
  context: DiagramExportContext,
): string {
  const selected = new Set(records.map((record) => record.id as string));
  return `${records.map((record) => report(record, selected, context)).join('\n---\n')}\n`;
}
