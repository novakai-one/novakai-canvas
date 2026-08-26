import type { TypeAst } from '../dsl-ast.ts';
import { DSL_GRAMMAR } from './grammar.ts';
import { ParserState } from './parser-state.ts';
import { parseInterfaceLine, parseTypeLine, tokenize } from './tokens.ts';

export function parseChild(state: ParserState, line: string, lineNumber: number): boolean {
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

export function parseMember(state: ParserState, line: string, lineNumber: number): boolean {
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
