/** Compiles already-resolved authored relationships into local wires or cross-map links. */

import type { WireAst } from '../wire-authoring.ts';
import { asId } from '../record-graph.ts';
import type { CompiledScope, WireCompileContext } from './contract.ts';
import { resolveWireEnds } from './wire-resolution.ts';

class WireCompiler {
  private readonly scope: CompiledScope;
  private readonly context: WireCompileContext;
  private wireCount = 0;

  constructor(scope: CompiledScope, context: WireCompileContext) {
    this.scope = scope;
    this.context = context;
  }

  compile(wires: WireAst[]): void {
    for (const wire of wires) this.compileWire(wire);
  }

  private compileWire(wire: WireAst): void {
    const resolved = resolveWireEnds(this.scope, this.context, wire);
    if (!resolved) return;
    const { source, target } = resolved;
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
}

/** Resolves and compiles one scope's relationships in authored order. */
export function compileScopeWires(scope: CompiledScope, context: WireCompileContext): void {
  new WireCompiler(scope, context).compile(scope.declared.scopeAst.wires);
}
