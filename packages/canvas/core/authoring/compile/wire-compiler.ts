/** Compiles already-resolved authored relationships into local wires or cross-map links. */

import type { WireAst } from '../wires/wire-authoring.ts';
import { orientationOf, resolveAxis } from '../../domain/axis.ts';
import { asId } from '../records/record-graph.ts';
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
      if (source.port || target.port) {
        this.context.messages.errors.push({
          message: `cross-map wire cannot address a method port`,
          hint: 'address both method ports inside one scope, or use node endpoints for a cross-map link',
          line: wire.line,
        });
        return;
      }
      if (wire.appearance) {
        this.context.messages.errors.push({
          message: `cross-map wire cannot carry appearance`,
          hint: 'wire appearance is local to one diagram layout; remove width, pattern, color and shape',
          line: wire.line,
        });
        return;
      }
      this.scope.diagram.crossDiagramWires.push({
        kind: wire.kind,
        label: wire.contract,
        source: { ...source.end, ...(wire.sourceCardinality ? { cardinality: wire.sourceCardinality } : {}) },
        target: { ...target.end, ...(wire.targetCardinality ? { cardinality: wire.targetCardinality } : {}) },
      });
      return;
    }
    this.wireCount += 1;
    const wireId = `${this.scope.diagram.rootNodeId}--wire-${this.wireCount}`;
    const axis = resolveAxis(orientationOf(this.scope.diagram));
    this.scope.diagram.wires[wireId] = {
      id: asId(wireId),
      kind: wire.kind,
      label: wire.contract,
      source: {
        nodeId: asId(source.local),
        ...(source.port ? { anchor: { side: axis.sourcePort, ordinal: source.port.ordinal } } : {}),
        ...(wire.sourceCardinality ? { cardinality: wire.sourceCardinality } : {}),
      },
      target: {
        nodeId: asId(target.local),
        ...(target.port ? { anchor: { side: axis.targetPort, ordinal: target.port.ordinal } } : {}),
        ...(wire.targetCardinality ? { cardinality: wire.targetCardinality } : {}),
      },
    };
    if (wire.appearance) this.scope.diagram.appearanceByWireId[wireId] = wire.appearance;
  }
}

/** Resolves and compiles one scope's relationships in authored order. */
export function compileScopeWires(scope: CompiledScope, context: WireCompileContext): void {
  new WireCompiler(scope, context).compile(scope.declared.scopeAst.wires);
}
