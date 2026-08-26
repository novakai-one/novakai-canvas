/** Parses wire declarations before the component statement grammar. */

import type { WireAst } from '../wire-authoring.ts';
import { parseWireAttributes, type AuthoredWireAttributes } from '../wire-attributes.ts';
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
    state.fail(lineNumber, 'wire endpoints must each be one name', 'quote multi-word names and ports: wire "browse CLI" -> "Broker.acquire" : ...');
    return;
  }
  const attributes = parseWireAttributes(targetTokens.tokens.slice(1));
  if (!attributes.valid) {
    state.fail(lineNumber, attributes.error, attributes.hint);
    return;
  }
  parseWireContract(
    state,
    sourceTokens.tokens[0],
    targetTokens.tokens[0],
    rest.slice(colon + 1).trim(),
    lineNumber,
    attributes.value,
  );
}

function parseWireContract(
  state: ParserState,
  source: string,
  target: string,
  authoredContract: string,
  lineNumber: number,
  attributes: AuthoredWireAttributes,
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
    ...attributes,
  });
}
