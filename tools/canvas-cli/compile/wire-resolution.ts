/** Deterministic local/cross-map endpoint resolution and authored diagnostics. */

import { slugify } from '../slug.ts';
import { wireReferenceKey } from '../wire-reference.ts';
import type { LinkEnd, WireAst } from '../wire-authoring.ts';
import type { CompiledScope, WireCompileContext } from './contract.ts';

export interface ResolvedWireEnd { local?: string; end: LinkEnd }
export interface ResolvedWireEnds { source: ResolvedWireEnd; target: ResolvedWireEnd }

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
    const source = this.resolveEnd(wire.source, localSource, localTarget, wire.line);
    const target = this.resolveEnd(wire.target, localTarget, localSource, wire.line);
    return source && target ? { source, target } : undefined;
  }

  private resolveLocal(name: string): string | undefined {
    const [namespace, value] = wireReferenceKey(name).split(':', 2);
    if (namespace === 'ref') return this.scope.endpointByRef.get(value);
    if (namespace === 'id') return this.scope.endpointById.get(value);
    return this.scope.endpointByLabelSlug.get(value);
  }

  private resolveEnd(
    name: string,
    local: string | undefined,
    nearNodeId: string | undefined,
    line: number,
  ): ResolvedWireEnd | undefined {
    if (local) return { local, end: { diagramId: this.scope.diagram.id, nodeId: local } };
    const far = this.resolveForeign(name, nearNodeId);
    if (far) return { end: far };
    this.context.messages.errors.push({
      message: `wire endpoint "${name}" (line ${line}) does not match any node`,
      hint: name.startsWith('@') || name.startsWith('#')
        ? 'use @ref for a referenced block or #node-id for an unreferenced local block'
        : `closest labels: ${closestCandidates(this.allLabels, name).join(', ')}`,
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
