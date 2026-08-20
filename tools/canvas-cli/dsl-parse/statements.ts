import type { DiagramComponent } from '../../../src/components/component.ts';
import type { NodeAst, ScopeAst, TypeAst, ZoneAst } from '../dsl-ast.ts';
import { DSL_GRAMMAR } from './grammar.ts';
import { ParserState } from './parser-state.ts';
import { splitPresentation } from './presentation.ts';
import { parseInterfaceLine, parseTypeLine, tokenize } from './tokens.ts';
import { parseWire } from './wire.ts';

function parseChild(state: ParserState, line: string, lineNumber: number): boolean {
  const child = DSL_GRAMMAR.child(line.split(/\s/)[0]);
  if (!child) return false;
  const node = state.currentNode();
  if (!node || node.kind !== child.kind) {
    state.fail(
      lineNumber,
      `${child.statement.keyword} outside a ${child.kind} node`,
      `declare a ${child.owner} first, then indent its ${child.statement.keyword} lines under it`,
    );
    return true;
  }
  const { tokens, error } = tokenize(line);
  if (error) {
    state.fail(lineNumber, `${error} in "${line}"`, 'close the double quote');
    return true;
  }
  const parsed = child.statement.parse(tokens, lineNumber);
  if ('error' in parsed) {
    state.fail(lineNumber, parsed.error, parsed.hint);
    return true;
  }
  const existing = node.children[child.statement.contentKey] ?? [];
  const validation = child.statement.validate?.(parsed.content, existing);
  if (validation) {
    state.fail(lineNumber, validation.error, validation.hint);
    return true;
  }
  (node.children[child.statement.contentKey] ??= []).push(parsed.content);
  return true;
}

function rejectMember(state: ParserState, lineNumber: number): boolean {
  const node = state.currentNode();
  if (!node) return false;
  const component = DSL_GRAMMAR.componentForKind(node.kind);
  if (component?.allowsMembers !== false) return false;
  state.fail(
    lineNumber,
    `${component.dslKeyword} does not accept methods or types`,
    'use its published child statements instead',
  );
  return true;
}

function parseMember(state: ParserState, line: string, lineNumber: number): boolean {
  const type = line.startsWith('type ') ? parseTypeLine(line) : null;
  const iface = type ? null : parseInterfaceLine(line);
  if (!type && !iface) return false;
  const node = state.currentNode();
  if (!node) {
    state.fail(
      lineNumber,
      type ? 'type outside a node' : 'interface line outside a node',
      type
        ? 'declare a module/object first, then indent its types under it'
        : 'declare a module/object first, then indent methods under it',
    );
    return true;
  }
  if (rejectMember(state, lineNumber)) return true;
  if (type) node.types.push(type as TypeAst);
  else node.interfaces.push(iface!);
  return true;
}

function parseScope(
  state: ParserState,
  component: DiagramComponent,
  tokens: string[],
  lineNumber: number,
): void {
  if (tokens.length < 2) {
    state.fail(lineNumber, 'scope needs a name', 'scope "My System"');
    return;
  }
  const split = splitPresentation(component, tokens);
  if ('error' in split) {
    state.fail(lineNumber, split.error, split.hint);
    return;
  }
  const scope: ScopeAst = {
    label: split.semanticTokens[1],
    ...(split.semanticTokens[2] === undefined ? {} : { description: split.semanticTokens[2] }),
    nodes: [], wires: [], zones: [], declarations: [],
    ...(split.presentation ? { presentation: split.presentation } : {}),
  };
  state.openScope(scope, lineNumber);
}

function parseComponent(
  state: ParserState,
  component: DiagramComponent,
  tokens: string[],
  lineNumber: number,
): void {
  if (!state.currentScope()) {
    state.fail(lineNumber, `${component.dslKeyword} outside a scope`, 'declare a scope first: scope "My System"');
    return;
  }
  const split = splitPresentation(component, tokens);
  if ('error' in split) {
    state.fail(lineNumber, split.error, split.hint);
    return;
  }
  const parsed = component.declaration.parse(split.semanticTokens);
  if ('error' in parsed) {
    state.fail(lineNumber, parsed.error, parsed.hint);
    return;
  }
  if (component.layoutRole === 'container') {
    const zone: ZoneAst = {
      label: parsed.label,
      ...(parsed.description === undefined ? {} : { description: parsed.description }),
      nodes: [], zones: [], declarations: [],
      ...(split.presentation ? { presentation: split.presentation } : {}),
      line: lineNumber,
    };
    state.openZone(zone);
    return;
  }
  const node: NodeAst = {
    kind: component.kind as NodeAst['kind'],
    label: parsed.label,
    ...(parsed.description === undefined ? {} : { description: parsed.description }),
    content: parsed.content ?? {}, interfaces: [], types: [], children: {},
    ...(split.presentation ? { presentation: split.presentation } : {}),
  };
  state.appendNode(node, component.declaration.allowsBody);
}

function parseGrammarStatement(
  state: ParserState,
  tokens: string[],
  lineNumber: number,
): void {
  const keyword = tokens[0];
  if (keyword === 'scope') {
    parseScope(state, DSL_GRAMMAR.componentForKind('group') as DiagramComponent, tokens, lineNumber);
    return;
  }
  const component = DSL_GRAMMAR.component(keyword);
  if (component) {
    parseComponent(state, component, tokens, lineNumber);
    return;
  }
  if (keyword === 'end') {
    if (tokens.length > 1) {
      state.fail(lineNumber, 'end takes no arguments', 'a bare end closes the innermost zone');
    } else state.closeZone(lineNumber);
    return;
  }
  state.fail(
    lineNumber,
    `unknown statement "${keyword}"`,
    `valid statements: ${DSL_GRAMMAR.statementHint()}; methods look like name(Input) -> Output under a node`,
  );
}

/** Parses one non-empty, non-comment source line in the grammar's fixed priority order. */
export function parseLine(state: ParserState, line: string, lineNumber: number): void {
  if (line.startsWith('wire ') || line === 'wire') return parseWire(state, line, lineNumber);
  if (parseChild(state, line, lineNumber)) return;
  if (parseMember(state, line, lineNumber)) return;
  const { tokens, error } = tokenize(line);
  if (error) {
    state.fail(lineNumber, `${error} in "${line}"`, 'close the double quote');
    return;
  }
  parseGrammarStatement(state, tokens, lineNumber);
}
