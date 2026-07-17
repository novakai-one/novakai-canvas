/** Compiles parsed scope ASTs into an ArchitectureDocument via scope-granular upsert. */

import type { ArchitectureDocument } from '../../src/domain/model';
import type { ScopeAst } from './dsl-parse.ts';
import { slugify } from './slug.ts';

export interface CompileError { message: string; hint: string }

export interface CompileResult {
  doc: ArchitectureDocument;
  errors: CompileError[];
  /** Ids of every scope the DSL declared (replaced or created). */
  touchedScopeIds: string[];
  /** Subset of touched scopes that did not exist before. */
  createdScopeIds: string[];
  /** Human-readable notes about content that could not be preserved. */
  warnings: string[];
}

type Nodes = ArchitectureDocument['nodes'];
type Wires = ArchitectureDocument['wires'];

const PLACEHOLDER_POSITION = { x: 0, y: 0 };
const PLACEHOLDER_SIZE = { width: 1, height: 1 };

function descendantsOf(nodes: Nodes, rootId: string): string[] {
  const result: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const node of Object.values(nodes)) {
      if (node.parentId === current) {
        result.push(node.id);
        queue.push(node.id);
      }
    }
  }
  return result;
}

function closestCandidates(labelSlugs: Map<string, string>, query: string): string[] {
  const querySlug = slugify(query);
  return [...labelSlugs.entries()]
    .map(([slug, label]) => {
      let score = 0;
      if (slug.includes(querySlug) || querySlug.includes(slug)) score = 2;
      else {
        let shared = 0;
        while (shared < Math.min(slug.length, querySlug.length) && slug[shared] === querySlug[shared]) shared += 1;
        score = shared / Math.max(slug.length, 1);
      }
      return { label, score };
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 5)
    .map((entry) => entry.label);
}

/** Pure upsert: returns a new document; positions/sizes of new nodes are placeholders for layout. */
export function compile(input: ArchitectureDocument, scopes: ScopeAst[]): CompileResult {
  const errors: CompileError[] = [];
  const warnings: string[] = [];
  const touchedScopeIds: string[] = [];
  const createdScopeIds: string[] = [];

  const nodes: Nodes = { ...input.nodes };
  const interfaces = { ...input.interfaces };
  const types = { ...input.types };
  const wires: Wires = { ...input.wires };

  for (const scopeAst of scopes) {
    const scopeSlug = slugify(scopeAst.label);
    const existingScope = Object.values(nodes).find(
      (node) => node.kind === 'scope' && !node.parentId && slugify(node.label) === scopeSlug,
    );
    const scopeId = existingScope?.id ?? scopeSlug;
    touchedScopeIds.push(scopeId);
    if (!existingScope) createdScopeIds.push(scopeId);

    // Remember old child ids by label slug so re-applied nodes keep stable ids.
    const removedIds = existingScope ? descendantsOf(nodes, existingScope.id) : [];
    const oldIdBySlug = new Map<string, string>();
    for (const id of removedIds) oldIdBySlug.set(slugify(nodes[id].label), id);

    for (const id of removedIds) {
      for (const interfaceId of nodes[id].interfaceIds) delete interfaces[interfaceId];
      for (const typeId of nodes[id].typeIds) delete types[typeId];
      delete nodes[id];
    }

    // Scope node itself (keeps id and position when it already existed).
    nodes[scopeId] = {
      id: scopeId,
      kind: 'scope',
      label: scopeAst.label,
      ...(scopeAst.description ? { description: scopeAst.description } : {}),
      position: existingScope ? existingScope.position : { ...PLACEHOLDER_POSITION },
      size: existingScope ? existingScope.size : { ...PLACEHOLDER_SIZE },
      interfaceIds: [],
      typeIds: [],
    };

    // Children.
    const idByLabelSlug = new Map<string, string>();
    let commentCount = 0;
    for (const nodeAst of scopeAst.nodes) {
      const labelSlug = nodeAst.kind === 'comment'
        ? `note-${(commentCount += 1)}-${slugify(nodeAst.label).slice(0, 24)}`
        : slugify(nodeAst.label);
      if (idByLabelSlug.has(labelSlug)) {
        errors.push({
          message: `duplicate node "${nodeAst.label}" in scope "${scopeAst.label}"`,
          hint: 'node names must be unique within a scope',
        });
        continue;
      }
      const nodeId = oldIdBySlug.get(labelSlug) ?? `${scopeId}--${labelSlug}`;
      idByLabelSlug.set(labelSlug, nodeId);

      const interfaceIds: string[] = [];
      for (const interfaceAst of nodeAst.interfaces) {
        let interfaceId = `${nodeId}--if-${slugify(interfaceAst.name)}`;
        while (interfaces[interfaceId]) interfaceId += '-x';
        interfaces[interfaceId] = {
          id: interfaceId, ownerId: nodeId,
          name: interfaceAst.name, accepts: interfaceAst.accepts, returns: interfaceAst.returns,
        };
        interfaceIds.push(interfaceId);
      }
      const typeIds: string[] = [];
      for (const typeAst of nodeAst.types) {
        let typeId = `${nodeId}--type-${slugify(typeAst.name)}`;
        while (types[typeId]) typeId += '-x';
        types[typeId] = { id: typeId, name: typeAst.name, fields: typeAst.fields };
        typeIds.push(typeId);
      }

      nodes[nodeId] = {
        id: nodeId,
        kind: nodeAst.kind,
        label: nodeAst.label,
        ...(nodeAst.description ? { description: nodeAst.description } : {}),
        position: { ...PLACEHOLDER_POSITION },
        size: { ...PLACEHOLDER_SIZE },
        parentId: scopeId,
        interfaceIds,
        typeIds,
      };
    }

    // Wires internal to the replaced scope are regenerated from the DSL; wires from
    // other scopes survive when their endpoint id was reused, otherwise they drop.
    for (const [wireId, wire] of Object.entries(wires)) {
      const sourceGone = !nodes[wire.source];
      const targetGone = !nodes[wire.target];
      if (sourceGone || targetGone) {
        delete wires[wireId];
        const internal = removedIds.includes(wire.source) && removedIds.includes(wire.target);
        if (!internal) {
          warnings.push(`dropped cross-scope wire: ${wire.source} -> ${wire.target} (${wire.label})`);
        }
      }
    }

    // New wires from the DSL.
    const resolve = (name: string): string | undefined => {
      const nameSlug = slugify(name);
      const local = idByLabelSlug.get(nameSlug);
      if (local) return local;
      return Object.values(nodes).find((node) => slugify(node.label) === nameSlug)?.id;
    };
    const allLabels = new Map<string, string>();
    for (const node of Object.values(nodes)) allLabels.set(slugify(node.label), node.label);

    let wireCount = 0;
    for (const wireAst of scopeAst.wires) {
      const source = resolve(wireAst.source);
      const target = resolve(wireAst.target);
      for (const [name, id] of [[wireAst.source, source], [wireAst.target, target]] as const) {
        if (!id) {
          errors.push({
            message: `wire endpoint "${name}" (line ${wireAst.line}) does not match any node`,
            hint: `closest labels: ${closestCandidates(allLabels, name).join(', ')}`,
          });
        }
      }
      if (!source || !target) continue;
      wireCount += 1;
      const wireId = `${scopeId}--wire-${wireCount}`;
      wires[wireId] = {
        id: wireId, source, target, label: wireAst.contract, kind: wireAst.kind, routing: 'elbow',
      };
    }
  }

  return {
    doc: { ...input, nodes, interfaces, types, wires },
    errors,
    touchedScopeIds,
    createdScopeIds,
    warnings,
  };
}
