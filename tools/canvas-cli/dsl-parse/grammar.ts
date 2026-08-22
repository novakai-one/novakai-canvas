import type { DiagramComponent, DslChildStatement } from '../../../src/components/component.ts';
import { allComponents } from '../../../src/components/registry.ts';
import type { WireAst } from '../wire-authoring.ts';

interface ChildOwner {
  kind: string;
  owner: string;
  statement: DslChildStatement;
}

const WIRE_KINDS: WireAst['kind'][] = [
  'owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing',
];

class DslGrammar {
  readonly components: Map<string, DiagramComponent>;
  readonly componentsByKind: Map<string, DiagramComponent>;
  readonly children: Map<string, ChildOwner>;
  readonly wireKinds: Set<string>;
  readonly statements: string;

  constructor(components: readonly DiagramComponent[]) {
    this.components = new Map(components.map((component) => [component.dslKeyword, component]));
    this.componentsByKind = new Map(components.map((component) => [component.kind, component]));
    this.children = new Map(components.flatMap((component) => (component.dslChildren ?? []).map(
      (statement) => [statement.keyword, {
        kind: component.kind, owner: component.dslKeyword, statement,
      }] as const,
    )));
    this.wireKinds = new Set(WIRE_KINDS);
    this.statements = [
      'scope', ...components.map((component) => component.dslKeyword), 'end',
      ...this.children.keys(), 'type', 'wire',
    ].join(', ');
  }

  component(keyword: string): DiagramComponent | undefined {
    return this.components.get(keyword);
  }

  componentForKind(kind: string): DiagramComponent | undefined {
    return this.componentsByKind.get(kind);
  }

  child(keyword: string): ChildOwner | undefined {
    return this.children.get(keyword);
  }

  isWireKind(value: string): value is WireAst['kind'] {
    return this.wireKinds.has(value);
  }

  statementHint(): string {
    return this.statements;
  }
}

/** Registry-derived grammar used by every parser statement. */
export const DSL_GRAMMAR = new DslGrammar(allComponents());
