import type { FlowAst, FlowStepAst, NodeAst, ParseError, ParseResult, ScopeAst, ZoneAst } from '../dsl-ast.ts';
import type { WireAst } from '../wires/wire-authoring.ts';

/** Mutable cursor for one parse; grammar handlers mutate it through these operations only. */
export class ParserState {
  private readonly scopes: ScopeAst[] = [];
  private readonly errors: ParseError[] = [];
  private scope: ScopeAst | null = null;
  private node: NodeAst | null = null;
  private zoneStack: ZoneAst[] = [];
  private flow: FlowAst | null = null;

  fail(line: number, message: string, hint: string): void {
    this.errors.push({ line, message, hint });
  }

  currentScope(): ScopeAst | null {
    return this.scope;
  }

  currentNode(): NodeAst | null {
    return this.node;
  }

  currentFlow(): FlowAst | null { return this.flow; }

  inZone(): boolean { return this.zoneStack.length > 0; }

  openScope(scope: ScopeAst, line: number): void {
    if (this.flow) {
      this.fail(line, `unclosed flow "${this.flow.label}" (line ${this.flow.line}) before new scope`, 'close the flow with end');
    }
    if (this.zoneStack.length > 0 && this.scope) {
      const unclosed = this.zoneStack[this.zoneStack.length - 1];
      this.fail(
        line,
        `unclosed zone "${unclosed.label}" (line ${unclosed.line}) before new scope`,
        'close every zone with end before starting a new scope',
      );
    }
    this.scope = scope;
    this.node = null;
    this.zoneStack = [];
    this.flow = null;
    this.scopes.push(scope);
  }

  openFlow(flow: FlowAst): void {
    (this.scope as ScopeAst).flows.push(flow);
    this.flow = flow;
    this.node = null;
  }

  appendFlowStep(step: FlowStepAst): void { (this.flow as FlowAst).steps.push(step); }

  closeFlow(): void { this.flow = null; }

  appendWire(wire: WireAst): void {
    (this.scope as ScopeAst).wires.push(wire);
  }

  openZone(zone: ZoneAst): void {
    const container = this.declarationContainer();
    container.zones.push(zone);
    container.declarations.push(zone);
    this.zoneStack.push(zone);
    this.node = null;
  }

  appendNode(node: NodeAst, allowsBody: boolean): void {
    const container = this.declarationContainer();
    container.nodes.push(node);
    container.declarations.push(node);
    this.node = allowsBody ? node : null;
  }

  closeZone(line: number): void {
    if (this.zoneStack.length === 0) {
      this.fail(line, 'end without an open zone', 'only close a zone opened with zone "Name"');
      return;
    }
    this.zoneStack.pop();
    this.node = null;
  }

  finish(lastLine: number): ParseResult {
    if (this.flow) {
      this.fail(lastLine, `unclosed flow "${this.flow.label}" (opened line ${this.flow.line})`, 'close the flow with end');
    }
    if (this.zoneStack.length > 0 && this.scope) {
      const zone = this.zoneStack[this.zoneStack.length - 1];
      this.fail(
        lastLine,
        `unclosed zone "${zone.label}" (opened line ${zone.line})`,
        'close every zone with end',
      );
    }
    return { scopes: this.scopes, errors: this.errors };
  }

  private declarationContainer(): ScopeAst | ZoneAst {
    return this.zoneStack.length > 0
      ? this.zoneStack[this.zoneStack.length - 1]
      : (this.scope as ScopeAst);
  }
}
