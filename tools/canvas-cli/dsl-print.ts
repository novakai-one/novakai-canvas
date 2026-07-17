/** Prints a document back as round-trippable DSL — the cheap way to reload context. */

import type { ArchitectureDocument } from '../../src/domain/model';

function quote(label: string): string {
  return `"${label}"`;
}

function childrenOf(doc: ArchitectureDocument, scopeId: string) {
  return Object.values(doc.nodes)
    .filter((node) => node.parentId === scopeId)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id));
}

function scopeIdOf(doc: ArchitectureDocument, nodeId: string): string | undefined {
  let current = doc.nodes[nodeId];
  while (current?.parentId) current = doc.nodes[current.parentId];
  return current?.id;
}

function wiresOf(doc: ArchitectureDocument, scopeId: string) {
  return Object.values(doc.wires)
    .filter((wire) => scopeIdOf(doc, wire.source) === scopeId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** One scope as DSL. */
export function printScope(doc: ArchitectureDocument, scopeId: string): string {
  const scope = doc.nodes[scopeId];
  const lines: string[] = [];
  lines.push(`scope ${quote(scope.label)}${scope.description ? ` ${quote(scope.description)}` : ''}`);

  for (const node of childrenOf(doc, scopeId)) {
    if (node.kind === 'comment') {
      lines.push(`  note ${quote(node.label)}`);
      continue;
    }
    lines.push(`  ${node.kind} ${quote(node.label)}${node.description ? ` ${quote(node.description)}` : ''}`);
    for (const interfaceId of node.interfaceIds) {
      const iface = doc.interfaces[interfaceId];
      lines.push(`    ${iface.name}(${iface.accepts.join(', ')}) -> ${iface.returns.join(', ')}`);
    }
    for (const typeId of node.typeIds) {
      const type = doc.types[typeId];
      lines.push(`    type ${type.name} { ${type.fields.join(', ')} }`);
    }
  }

  for (const wire of wiresOf(doc, scopeId)) {
    const source = doc.nodes[wire.source];
    const target = doc.nodes[wire.target];
    const kind = wire.kind === 'references' ? '' : ` [${wire.kind}]`;
    lines.push(`  wire ${quote(source.label)} -> ${quote(target.label)} : ${wire.label}${kind}`);
  }

  return `${lines.join('\n')}\n`;
}

/** Every scope as DSL, in vertical document order. */
export function printOutline(doc: ArchitectureDocument): string {
  return topLevelScopes(doc).map((scope) => printScope(doc, scope.id)).join('\n');
}

function topLevelScopes(doc: ArchitectureDocument) {
  return Object.values(doc.nodes)
    .filter((node) => node.kind === 'scope' && !node.parentId)
    .sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id));
}

/** Top-level scopes with content counts. */
export function listMaps(doc: ArchitectureDocument): { id: string; label: string; nodes: number; wires: number }[] {
  return topLevelScopes(doc).map((scope) => {
    let nodes = 0;
    const queue = [scope.id];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const node of Object.values(doc.nodes)) {
        if (node.parentId === current) {
          nodes += 1;
          queue.push(node.id);
        }
      }
    }
    return { id: scope.id, label: scope.label, nodes, wires: wiresOf(doc, scope.id).length };
  });
}
