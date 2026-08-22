import type { WireAst } from '../dsl-ast.ts';
import { asId } from '../record-graph.ts';
import { slugify } from '../slug.ts';
import { wireReferenceKey } from '../wire-reference.ts';
import type {
  CompiledScope, LinkEnd, WireCompileContext,
} from './contract.ts';

interface ResolvedEnd {
  local: string | undefined;
  end: LinkEnd;
}

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

class WireCompiler {
  private readonly scope: CompiledScope;
  private readonly context: WireCompileContext;
  private readonly allLabels: Map<string, string>;
  private wireCount = 0;

  constructor(scope: CompiledScope, context: WireCompileContext) {
    this.scope = scope;
    this.context = context;
    this.allLabels = new Map([
      ...context.foreign.labels.entries(),
      ...scope.localLabels.entries(),
    ]);
  }

  compile(wires: WireAst[]): void {
    for (const wire of wires) this.compileWire(wire);
  }

  private compileWire(wire: WireAst): void {
    const localSource = this.resolveLocal(wire.source);
    const localTarget = this.resolveLocal(wire.target);
    const source = this.resolveEnd(wire.source, localSource, localTarget, wire.line);
    const target = this.resolveEnd(wire.target, localTarget, localSource, wire.line);
    if (!source || !target) return;
    if (!source.local || !target.local) {
      if (wire.appearance) {
        this.context.messages.errors.push({
          message: `cross-map wire on line ${wire.line} cannot carry appearance`,
          hint: 'wire appearance is local to one diagram layout; remove width, pattern, color and shape',
        });
        return;
      }
      this.scope.diagram.crossDiagramWires.push({
        kind: wire.kind,
        label: wire.contract,
        source: source.end,
        target: target.end,
      });
      return;
    }
    this.wireCount += 1;
    const wireId = `${this.scope.diagram.rootNodeId}--wire-${this.wireCount}`;
    this.scope.diagram.wires[wireId] = {
      id: asId(wireId),
      kind: wire.kind,
      label: wire.contract,
      source: { nodeId: asId(source.local) },
      target: { nodeId: asId(target.local) },
    };
    if (wire.appearance) this.scope.diagram.appearanceByWireId[wireId] = wire.appearance;
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
  ): ResolvedEnd | undefined {
    if (local) return {
      local,
      end: { diagramId: this.scope.diagram.id, nodeId: local },
    };
    const far = wireReferenceKey(name).startsWith('label:')
      ? this.resolveForeign(name, nearNodeId) : undefined;
    if (far) return { local: undefined, end: far };
    this.context.messages.errors.push({
      message: `wire endpoint "${name}" (line ${line}) does not match any node`,
      hint: name.startsWith('@') || name.startsWith('#')
        ? 'use @ref for a referenced block or #node-id for an unreferenced local block'
        : `closest labels: ${closestCandidates(this.allLabels, name).join(', ')}`,
    });
    return undefined;
  }

  private resolveForeign(name: string, nearNodeId: string | undefined): LinkEnd | undefined {
    const candidates = this.context.foreign.ends.get(slugify(name));
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

/** Resolves one compiled scope's local and cross-diagram wires in authored order. */
export function compileScopeWires(
  scope: CompiledScope,
  context: WireCompileContext,
): void {
  new WireCompiler(scope, context).compile(scope.declared.scopeAst.wires);
}
