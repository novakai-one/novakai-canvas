import { componentFor } from '../components/registry.ts';
import { appearanceSpecification } from '../domain/canvas-presentation.ts';
import type { DiagramRecord } from '../domain/records.ts';
import { arrangementAttributes, childrenOf, quote, type ExportNode } from './ordering.ts';

type Layout = DiagramRecord['layouts'][string] | undefined;

class DeclarationPrinter {
  private readonly record: DiagramRecord;
  private readonly nodes: Record<string, ExportNode>;
  private readonly layout: Layout;

  constructor(record: DiagramRecord, nodes: Record<string, ExportNode>, layout: Layout) {
    this.record = record;
    this.nodes = nodes;
    this.layout = layout;
  }

  print(containerId: string | undefined, indent: string): string[] {
    const arrangement = containerId
      ? this.layout?.arrangementByContainerId?.[containerId] : undefined;
    return childrenOf(this.nodes, containerId, arrangement)
      .flatMap((node) => this.printNode(node, indent));
  }

  private printNode(node: ExportNode, indent: string): string[] {
    const component = componentFor(node.kind);
    const declaration = this.declarationLine(node, indent);
    if (component.layoutRole === 'container') {
      return [
        declaration,
        ...this.print(node.id as string, `${indent}  `),
        `${indent}end`,
      ];
    }
    const lines = [declaration];
    this.appendMembers(lines, node, indent);
    for (const statement of component.dslChildren ?? []) {
      for (const childLine of statement.print(node)) lines.push(`${indent}${childLine}`);
    }
    return lines;
  }

  private declarationLine(node: ExportNode, indent: string): string {
    const component = componentFor(node.kind);
    const authored = this.layout?.appearanceByNodeId?.[node.id];
    const appearance = (component.appearanceKeys ?? []).flatMap((key) => {
      const specification = appearanceSpecification(key);
      const value = authored?.[specification.jsonKey];
      return value === undefined ? [] : [`${key}=${String(value)}`];
    });
    const arrangement = component.layoutRole === 'container'
      ? arrangementAttributes(this.layout?.arrangementByContainerId?.[node.id]) : [];
    const boundary = component.layoutRole === 'container' && node.crossing
      ? [
        `crossing=${node.crossing}`,
        ...(node.gate ? [`gate=${quote(this.record.nodes[node.gate]?.label ?? node.gate)}`] : []),
      ]
      : [];
    // Frame ordinals are durable node data; printed only when declared, leaf nodes only.
    const topology = component.layoutRole === 'leaf'
      ? [
        ...(node.band === undefined ? [] : [`band=${node.band}`]),
        ...(node.lane === undefined ? [] : [`lane=${node.lane}`]),
      ]
      : [];
    const attributes = [...appearance, ...arrangement, ...boundary, ...topology];
    return `${indent}${component.declaration.print(node)}`
      + `${attributes.length ? ` ${attributes.join(' ')}` : ''}`;
  }

  private appendMembers(lines: string[], node: ExportNode, indent: string): void {
    for (const interfaceId of node.interfaceIds) {
      const method = this.record.interfaces[interfaceId];
      if (!method) continue;
      lines.push(
        `${indent}  ${method.name}(${method.accepts.join(', ')}) -> ${method.returns.join(', ')}`,
      );
    }
    for (const typeId of node.typeIds) {
      const type = this.record.types[typeId];
      if (!type) continue;
      lines.push(`${indent}  type ${type.name} { ${type.fields.join(', ')} }`);
    }
  }
}

/** Prints every declaration below one container in canonical recursive order. */
export function printDeclarations(
  record: DiagramRecord,
  nodes: Record<string, ExportNode>,
  layout: Layout,
  containerId: string | undefined,
): string[] {
  return new DeclarationPrinter(record, nodes, layout).print(containerId, '  ');
}
