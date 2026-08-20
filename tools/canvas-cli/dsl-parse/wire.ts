/** Parses wire declarations before the component statement grammar. */

import type { WireAst } from '../dsl-ast.ts';
import {
  WIRE_APPEARANCE_SPECIFICATIONS, canonicalWireAppearance,
  type WireAppearance,
} from '../../../src/domain/wire-appearance.ts';
import { DSL_GRAMMAR } from './grammar.ts';
import { ParserState } from './parser-state.ts';
import { tokenize } from './tokens.ts';

/** Parses one wire line into the active scope. */
export function parseWire(state: ParserState, line: string, lineNumber: number): void {
  if (!state.currentScope()) {
    state.fail(lineNumber, 'wire outside a scope', 'declare a scope first: scope "My System"');
    return;
  }
  const body = line.slice(4).trim();
  const arrow = body.indexOf('->');
  if (arrow === -1) {
    state.fail(lineNumber, 'wire needs a source and target', 'wire A -> B : call(Input) -> Output');
    return;
  }
  const sourceTokens = tokenize(body.slice(0, arrow).trim());
  const rest = body.slice(arrow + 2).trim();
  const colon = rest.indexOf(':');
  if (colon === -1) {
    state.fail(lineNumber, 'wire needs a contract (the call it carries)', 'wire A -> B : acquire(AgentId) -> SessionHandle');
    return;
  }
  const targetTokens = tokenize(rest.slice(0, colon).trim());
  if (sourceTokens.error || targetTokens.error) {
    state.fail(lineNumber, 'unbalanced quote in wire', 'quote multi-word names: wire "browse CLI" -> Broker : ...');
    return;
  }
  if (sourceTokens.tokens.length !== 1 || targetTokens.tokens.length < 1) {
    state.fail(lineNumber, 'wire endpoints must each be one name', 'quote multi-word names: wire "browse CLI" -> Broker : ...');
    return;
  }
  const appearance = parseWireAppearance(state, targetTokens.tokens.slice(1), lineNumber);
  if (appearance === null) return;
  parseWireContract(
    state,
    sourceTokens.tokens[0],
    targetTokens.tokens[0],
    rest.slice(colon + 1).trim(),
    lineNumber,
    appearance,
  );
}

function parseWireAppearance(
  state: ParserState,
  tokens: string[],
  lineNumber: number,
): WireAppearance | null {
  const appearance: WireAppearance = {};
  const seen = new Set<string>();
  for (const token of tokens) {
    const equals = token.indexOf('=');
    const key = token.slice(0, Math.max(0, equals)) as keyof WireAppearance;
    const specification = WIRE_APPEARANCE_SPECIFICATIONS.find((entry) => entry.key === key);
    if (equals < 1 || !specification) {
      state.fail(lineNumber, `unknown wire attribute "${equals < 1 ? token : key}"`, 'use width=thin|medium|thick pattern=solid|dashed|dotted|dashdot color=neutral|green|blue|violet|rose|amber');
      return null;
    }
    if (seen.has(key)) {
      state.fail(lineNumber, `duplicate wire attribute "${key}"`, `write ${key}= once`);
      return null;
    }
    seen.add(key);
    const raw = token.slice(equals + 1);
    if (!specification.values.some((value) => value === raw)) {
      state.fail(lineNumber, `invalid wire ${key} "${raw}"`, `use one of: ${specification.values.join(', ')}`);
      return null;
    }
    (appearance as Record<string, unknown>)[key] = raw;
  }
  return canonicalWireAppearance(appearance);
}

function parseWireContract(
  state: ParserState,
  source: string,
  target: string,
  authoredContract: string,
  lineNumber: number,
  appearance: WireAppearance | undefined,
): void {
  let contract = authoredContract;
  let kind: WireAst['kind'] = 'references';
  const kindMatch = /\[([a-z]+)\]\s*$/.exec(contract);
  if (kindMatch) {
    if (!DSL_GRAMMAR.isWireKind(kindMatch[1])) {
      state.fail(lineNumber, `unknown wire kind "${kindMatch[1]}"`, `use one of: ${[...DSL_GRAMMAR.wireKinds].join(', ')}`);
      return;
    }
    kind = kindMatch[1];
    contract = contract.slice(0, kindMatch.index).trim();
  }
  if (contract.length === 0) {
    state.fail(lineNumber, 'wire needs a contract (the call it carries)', 'wire A -> B : acquire(AgentId) -> SessionHandle');
    return;
  }
  state.appendWire({
    source, target, contract, kind, line: lineNumber,
    ...(appearance && Object.keys(appearance).length > 0 ? { appearance } : {}),
  });
}
