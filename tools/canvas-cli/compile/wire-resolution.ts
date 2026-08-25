/** Deterministic local/cross-map endpoint resolution and authored diagnostics. */

import { slugify } from '../../../src/authoring/slug.ts';
import {
  portReferenceParts, wireReferenceKey,
} from '../../../src/authoring/wire-reference.ts';
import type { LinkEnd, WireAst } from '../wire-authoring.ts';
import type { CompiledScope, WireCompileContext } from './contract.ts';

/** One declared method resolved at authoring time; ordinal is the durable identity. */
export interface PortEndpoint { nodeId: string; interfaceId: string; ordinal: number }

export interface ResolvedWireEnd { local?: string; end: LinkEnd; port?: PortEndpoint }
export interface ResolvedWireEnds { source: ResolvedWireEnd; target: ResolvedWireEnd }
type LocalResolution =
  | { kind: 'resolved'; nodeId: string; port?: PortEndpoint }
  | { kind: 'ambiguous'; count: number }
  | { kind: 'ambiguous-method'; nodeLabel: string; method: string; count: number }
  | { kind: 'missing-method'; nodeId: string; nodeLabel: string; method: string; methods: string[] }
  | { kind: 'missing-port-node'; node: string }
  | { kind: 'missing' };

function closestCandidates(labels: Map<string, string>, query: string): string[] {
  const querySlug = slugify(query);
  return [...labels.entries()]
    .map(([slug, label]) => {
      let score = 0;
      if (slug.includes(querySlug) || querySlug.includes(slug)) score = 2;
      else {
        let shared = 0;
        while (shared < Math.min(slug.length, querySlug.length)
          && slug[shared] === querySlug[shared]) shared += 1;
        score = shared / Math.max(slug.length, 1);
      }
      return { label, score };
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 5)
    .map((entry) => entry.label);
}

class WireResolver {
  private readonly allLabels: Map<string, string>;
  private readonly scope: CompiledScope;
  private readonly context: WireCompileContext;

  constructor(scope: CompiledScope, context: WireCompileContext) {
    this.scope = scope;
    this.context = context;
    this.allLabels = new Map([
      ...context.foreign.labels.entries(),
      ...scope.localLabels.entries(),
    ]);
  }

  resolve(wire: WireAst): ResolvedWireEnds | undefined {
    const localSource = this.resolveLocal(wire.source);
    const localTarget = this.resolveLocal(wire.target);
    const source = this.resolveEnd(
      wire.source, localSource,
      localTarget.kind === 'resolved' ? localTarget.nodeId : undefined,
      wire.line,
    );
    const target = this.resolveEnd(
      wire.target, localTarget,
      localSource.kind === 'resolved' ? localSource.nodeId : undefined,
      wire.line,
    );
    return source && target ? { source, target } : undefined;
  }

  private resolveLocal(name: string): LocalResolution {
    const key = wireReferenceKey(name);
    const separator = key.indexOf(':');
    const namespace = key.slice(0, separator);
    const value = key.slice(separator + 1);
    if (namespace === 'ref' || namespace === 'id') {
      const nodeId = namespace === 'ref'
        ? this.scope.endpointByRef.get(value) : this.scope.endpointById.get(value);
      return nodeId ? { kind: 'resolved', nodeId } : { kind: 'missing' };
    }
    if (namespace === 'port') {
      // An exact old full-label match wins before the new dotted interpretation.
      const exact = this.scope.endpointByLabelSlug.get(slugify(name)) ?? [];
      if (exact.length === 1) return { kind: 'resolved', nodeId: exact[0] };
      if (exact.length > 1) return { kind: 'ambiguous', count: exact.length };
      return this.resolvePort(name);
    }
    const matches = this.scope.endpointByLabelSlug.get(value) ?? [];
    if (matches.length === 1) return { kind: 'resolved', nodeId: matches[0] };
    return matches.length > 1
      ? { kind: 'ambiguous', count: matches.length }
      : { kind: 'missing' };
  }

  private resolvePort(name: string): LocalResolution {
    const parts = portReferenceParts(name);
    if (!parts) return { kind: 'missing' };
    const nodeMatches = this.scope.endpointByLabelSlug.get(slugify(parts.node)) ?? [];
    if (nodeMatches.length > 1) return { kind: 'ambiguous', count: nodeMatches.length };
    const nodeId = nodeMatches[0];
    if (!nodeId) return { kind: 'missing-port-node', node: parts.node };
    const node = this.scope.diagram.nodes[nodeId];
    const methods = node.interfaceIds.flatMap((interfaceId, ordinal) => {
      const item = this.scope.diagram.interfaces[interfaceId];
      return item ? [{ item, ordinal }] : [];
    });
    const matches = methods.filter(({ item }) => item.name === parts.method);
    if (matches.length > 1) {
      return {
        kind: 'ambiguous-method', nodeLabel: node.label,
        method: parts.method, count: matches.length,
      };
    }
    if (matches.length === 0) {
      return {
        kind: 'missing-method', nodeId, nodeLabel: node.label, method: parts.method,
        methods: methods.map(({ item }) => item.name),
      };
    }
    const match = matches[0];
    return {
      kind: 'resolved', nodeId,
      port: { nodeId, interfaceId: match.item.id, ordinal: match.ordinal },
    };
  }

  private resolveEnd(
    name: string,
    local: LocalResolution,
    nearNodeId: string | undefined,
    line: number,
  ): ResolvedWireEnd | undefined {
    if (local.kind === 'resolved') {
      return {
        local: local.nodeId,
        end: { diagramId: this.scope.diagram.id, nodeId: local.nodeId },
        ...(local.port ? { port: local.port } : {}),
      };
    }
    if (local.kind === 'ambiguous') {
      this.context.messages.errors.push({
        message: `wire endpoint "${name}" matches ${local.count} local nodes`,
        hint: 'use @ref or #node-id to choose one local node',
        line,
      });
      return undefined;
    }
    if (local.kind === 'ambiguous-method') {
      this.context.messages.errors.push({
        message: `wire endpoint "${name}" matches ${local.count} methods named "${local.method}" on "${local.nodeLabel}"`,
        hint: 'give each declared method a unique name',
        line,
      });
      return undefined;
    }
    if (local.kind === 'missing-method') {
      // An exact dotted label in another map predates and outranks port interpretation.
      const far = this.resolveForeign(name, nearNodeId);
      if (far) return { end: far };
      const candidates = new Map(local.methods.map((method) => [slugify(method), method]));
      this.context.messages.errors.push({
        message: `wire endpoint "${name}" names undeclared method "${local.method}" on "${local.nodeLabel}"`,
        hint: local.methods.length > 0
          ? `declared methods: ${local.methods.join(', ')}; closest: ${closestCandidates(candidates, local.method).join(', ')}`
          : `"${local.nodeLabel}" declares no methods; declare "${local.method}" or address the node without a port`,
        line,
      });
      return undefined;
    }
    if (local.kind === 'missing-port-node') {
      // A dotted label in another map was valid before method ports existed.
      const far = this.resolveForeign(name, nearNodeId);
      if (far) return { end: far };
      this.context.messages.errors.push({
        message: `wire endpoint "${name}" names unknown node "${local.node}"`,
        hint: `closest labels: ${closestCandidates(this.scope.localLabels, local.node).join(', ')}`,
        line,
      });
      return undefined;
    }
    const far = this.resolveForeign(name, nearNodeId);
    if (far) return { end: far };
    this.context.messages.errors.push({
      message: `wire endpoint "${name}" does not match any node`,
      hint: ['ref', 'id'].includes(wireReferenceKey(name).slice(0, wireReferenceKey(name).indexOf(':')))
        ? 'use @ref for a referenced block or #node-id for an unreferenced local block'
        : `closest labels: ${closestCandidates(this.allLabels, name).join(', ')}`,
      line,
    });
    return undefined;
  }

  private resolveForeign(name: string, nearNodeId: string | undefined): LinkEnd | undefined {
    const candidates = this.context.foreign.ends.get(wireReferenceKey(name));
    if (!candidates || candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];
    const alreadyLinked = candidates.find((candidate) => this.context.links.some((link) =>
      (link.source.nodeId === nearNodeId && link.target.nodeId === candidate.nodeId)
      || (link.target.nodeId === nearNodeId && link.source.nodeId === candidate.nodeId)));
    if (alreadyLinked) return alreadyLinked;
    const sorted = [...candidates].sort((a, b) => a.diagramId.localeCompare(b.diagramId));
    this.context.messages.warnings.push(
      `"${name}" names a node in ${candidates.length} other maps — linked to ${sorted[0].diagramId}`,
    );
    return sorted[0];
  }
}

/** Resolves both ends or appends the same ordered diagnostics as the original compiler. */
export function resolveWireEnds(
  scope: CompiledScope,
  context: WireCompileContext,
  wire: WireAst,
): ResolvedWireEnds | undefined {
  return new WireResolver(scope, context).resolve(wire);
}
