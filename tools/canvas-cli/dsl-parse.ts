/**
 * Line-oriented DSL parser. Collects every error; never throws.
 *
 * The shape vocabulary — which keyword declares which node kind, and which child lines a node
 * may own — comes from the component registry, so a new shape is a registration, not an edit
 * here. Only grammar words are written down in this file: `scope`, `end`, `wire`, `type`, and
 * method lines, plus the two statements whose shape is not "keyword name [description]"
 * (`zone`, which opens a block, and `note`, which takes text only).
 */

import type { DslChildStatement } from '../../src/components/component.ts';
import { allComponents } from '../../src/components/registry.ts';

export interface ParseError { line: number; message: string; hint: string }
export interface InterfaceAst { name: string; accepts: string[]; returns: string[] }
export interface TypeAst { name: string; fields: string[] }
export interface TreeRowAst {
  id: string;
  kind: 'project' | 'mission' | 'task' | 'bucket';
  status?: string;
  parentRowId?: string;
  badges: string[];
  label?: string;
}
export interface NodeAst {
  kind: 'module' | 'object' | 'runtime' | 'resource' | 'comment' | 'tree';
  label: string;
  description?: string;
  interfaces: InterfaceAst[];
  types: TypeAst[];
  rows: TreeRowAst[];
}
export interface WireAst {
  source: string;
  target: string;
  contract: string;
  kind: 'owns' | 'references' | 'assigns' | 'queries' | 'executes' | 'mentions' | 'missing';
  line: number;
}
/** A nested container inside a scope; compiles to a scope node with parentId set. */
export interface ZoneAst {
  label: string;
  description?: string;
  nodes: NodeAst[];
  zones: ZoneAst[];
  line: number;
}
export interface ScopeAst { label: string; description?: string; nodes: NodeAst[]; wires: WireAst[]; zones: ZoneAst[] }

/** Keywords that open a nested container block, closed by `end`. */
const CONTAINER_KEYWORDS = new Set(
  allComponents().filter((component) => component.layoutRole === 'container')
    .map((component) => component.dslKeyword),
);
/** Keyword -> node kind for every non-container shape in the registry. */
const NODE_KINDS = new Map(
  allComponents().filter((component) => component.layoutRole !== 'container')
    .map((component) => [component.dslKeyword, component.kind]),
);
/** Child lines a node owns (tree's `row`), by keyword, with the kind allowed to hold them. */
const CHILD_STATEMENTS = new Map<string, { kind: string; owner: string; statement: DslChildStatement }>(
  allComponents().flatMap((component) => (component.dslChildren ?? []).map(
    (statement) => [statement.keyword, { kind: component.kind, owner: component.dslKeyword, statement }] as const,
  )),
);
const WIRE_KINDS = new Set(['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing']);
const STATEMENTS = [
  'scope', ...allComponents().map((component) => component.dslKeyword), 'end',
  ...CHILD_STATEMENTS.keys(), 'type', 'wire',
].join(', ');

/** Splits a line into tokens, treating double-quoted spans as single tokens. */
function tokenize(line: string): { tokens: string[]; error?: string } {
  const tokens: string[] = [];
  let index = 0;
  while (index < line.length) {
    const char = line[index];
    if (/\s/.test(char)) { index += 1; continue; }
    if (char === '"') {
      const close = line.indexOf('"', index + 1);
      if (close === -1) return { tokens, error: 'unbalanced quote' };
      tokens.push(line.slice(index + 1, close));
      index = close + 1;
      continue;
    }
    let end = index;
    while (end < line.length && !/[\s"]/.test(line[end])) end += 1;
    tokens.push(line.slice(index, end));
    index = end;
  }
  return { tokens };
}

function parseInterfaceLine(line: string): InterfaceAst | null {
  const match = /^([A-Za-z_][\w-]*)\(([^)]*)\)\s*->\s*(.+)$/.exec(line);
  if (!match) return null;
  const list = (raw: string): string[] =>
    raw.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
  return { name: match[1], accepts: list(match[2]), returns: list(match[3]) };
}

function parseTypeLine(line: string): TypeAst | null {
  const match = /^type\s+([A-Za-z_][\w-]*)\s*\{([^}]*)\}\s*$/.exec(line);
  if (!match) return null;
  return {
    name: match[1],
    fields: match[2].split(',').map((part) => part.trim()).filter((part) => part.length > 0),
  };
}

/** Parses DSL source into scope ASTs plus every error found. */
export function parseDsl(source: string): { scopes: ScopeAst[]; errors: ParseError[] } {
  const scopes: ScopeAst[] = [];
  const errors: ParseError[] = [];
  let scope: ScopeAst | null = null;
  let node: NodeAst | null = null;
  let zoneStack: ZoneAst[] = [];

  /** Nodes attach to the innermost open zone, or the scope itself. */
  const nodeSink = (): NodeAst[] =>
    zoneStack.length > 0 ? zoneStack[zoneStack.length - 1].nodes : (scope as ScopeAst).nodes;

  const lines = source.split('\n');
  for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
    const raw = lines[lineNumber - 1];
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;

    const fail = (message: string, hint: string): void => {
      errors.push({ line: lineNumber, message, hint });
    };

    if (line.startsWith('wire ') || line === 'wire') {
      if (!scope) {
        fail('wire outside a scope', 'declare a scope first: scope "My System"');
        continue;
      }
      const body = line.slice(4).trim();
      const arrow = body.indexOf('->');
      if (arrow === -1) {
        fail('wire needs a source and target', 'wire A -> B : call(Input) -> Output');
        continue;
      }
      const sourceTokens = tokenize(body.slice(0, arrow).trim());
      const rest = body.slice(arrow + 2).trim();
      const colon = rest.indexOf(':');
      if (colon === -1) {
        fail(
          'wire needs a contract (the call it carries)',
          'wire A -> B : acquire(AgentId) -> SessionHandle',
        );
        continue;
      }
      const targetTokens = tokenize(rest.slice(0, colon).trim());
      if (sourceTokens.error || targetTokens.error) {
        fail('unbalanced quote in wire', 'quote multi-word names: wire "browse CLI" -> Broker : ...');
        continue;
      }
      if (sourceTokens.tokens.length !== 1 || targetTokens.tokens.length !== 1) {
        fail('wire endpoints must each be one name', 'quote multi-word names: wire "browse CLI" -> Broker : ...');
        continue;
      }
      let contract = rest.slice(colon + 1).trim();
      let kind: WireAst['kind'] = 'references';
      const kindMatch = /\[([a-z]+)\]\s*$/.exec(contract);
      if (kindMatch) {
        if (!WIRE_KINDS.has(kindMatch[1])) {
          fail(`unknown wire kind "${kindMatch[1]}"`, `use one of: ${[...WIRE_KINDS].join(', ')}`);
          continue;
        }
        kind = kindMatch[1] as WireAst['kind'];
        contract = contract.slice(0, kindMatch.index).trim();
      }
      if (contract.length === 0) {
        fail('wire needs a contract (the call it carries)', 'wire A -> B : acquire(AgentId) -> SessionHandle');
        continue;
      }
      scope.wires.push({
        source: sourceTokens.tokens[0], target: targetTokens.tokens[0], contract, kind, line: lineNumber,
      });
      continue;
    }

    const child = CHILD_STATEMENTS.get(line.split(/\s/)[0]);
    if (child) {
      if (!node || node.kind !== child.kind) {
        fail(
          `${child.statement.keyword} outside a ${child.kind} node`,
          `declare a ${child.owner} first, then indent its ${child.statement.keyword} lines under it`,
        );
        continue;
      }
      const { tokens, error } = tokenize(line);
      if (error) {
        fail(`${error} in "${line}"`, 'close the double quote');
        continue;
      }
      const parsed = child.statement.parse(tokens, lineNumber);
      if ('error' in parsed) {
        fail(parsed.error, parsed.hint);
        continue;
      }
      // `rows` is the AST's only child-content bucket today; the second child-owning kind is
      // what earns a generic one.
      node.rows.push(parsed.content as TreeRowAst);
      continue;
    }

    if (line.startsWith('type ') && parseTypeLine(line)) {
      if (!node) {
        fail('type outside a node', 'declare a module/object first, then indent its types under it');
        continue;
      }
      node.types.push(parseTypeLine(line) as TypeAst);
      continue;
    }

    const asInterface = parseInterfaceLine(line);
    if (asInterface) {
      if (!node) {
        fail('interface line outside a node', 'declare a module/object first, then indent methods under it');
        continue;
      }
      node.interfaces.push(asInterface);
      continue;
    }

    const { tokens, error } = tokenize(line);
    if (error) {
      fail(`${error} in "${line}"`, 'close the double quote');
      continue;
    }
    const keyword = tokens[0];

    if (keyword === 'scope') {
      if (tokens.length < 2) {
        fail('scope needs a name', 'scope "My System"');
        continue;
      }
      if (zoneStack.length > 0 && scope) {
        fail(
          `unclosed zone "${zoneStack[zoneStack.length - 1].label}" (line ${zoneStack[zoneStack.length - 1].line}) before new scope`,
          'close every zone with end before starting a new scope',
        );
      }
      scope = { label: tokens[1], description: tokens[2], nodes: [], wires: [], zones: [] };
      node = null;
      zoneStack = [];
      scopes.push(scope);
      continue;
    }

    if (CONTAINER_KEYWORDS.has(keyword)) {
      if (!scope) {
        fail(`${keyword} outside a scope`, 'declare a scope first: scope "My System"');
        continue;
      }
      if (tokens.length < 2) {
        fail(`${keyword} needs a name`, `${keyword} "Stores" "optional description"`);
        continue;
      }
      const zone: ZoneAst = { label: tokens[1], description: tokens[2], nodes: [], zones: [], line: lineNumber };
      if (zoneStack.length > 0) zoneStack[zoneStack.length - 1].zones.push(zone);
      else scope.zones.push(zone);
      zoneStack.push(zone);
      node = null;
      continue;
    }

    if (keyword === 'end') {
      if (tokens.length > 1) {
        fail('end takes no arguments', 'a bare end closes the innermost zone');
        continue;
      }
      if (zoneStack.length === 0) {
        fail('end without an open zone', 'only close a zone opened with zone "Name"');
        continue;
      }
      zoneStack.pop();
      node = null;
      continue;
    }

    const kind = NODE_KINDS.get(keyword);

    // `note` is the one shape whose statement is text only: no description, no member lines.
    if (keyword === 'note' && kind !== undefined) {
      if (!scope) {
        fail('note outside a scope', 'declare a scope first: scope "My System"');
        continue;
      }
      if (tokens.length < 2) {
        fail('note needs text', 'note "Why this shape is load-bearing."');
        continue;
      }
      nodeSink().push({ kind: kind as NodeAst['kind'], label: tokens[1], interfaces: [], types: [], rows: [] });
      node = null;
      continue;
    }

    if (kind !== undefined) {
      if (!scope) {
        fail(`${keyword} outside a scope`, 'declare a scope first: scope "My System"');
        continue;
      }
      if (tokens.length < 2) {
        fail(`${keyword} needs a name`, `${keyword} "Session broker" "optional description"`);
        continue;
      }
      node = {
        kind: kind as NodeAst['kind'],
        label: tokens[1],
        description: tokens[2],
        interfaces: [],
        types: [],
        rows: [],
      };
      nodeSink().push(node);
      continue;
    }

    fail(
      `unknown statement "${keyword}"`,
      `valid statements: ${STATEMENTS}; methods look like name(Input) -> Output under a node`,
    );
  }

  if (zoneStack.length > 0 && scope) {
    const zone = zoneStack[zoneStack.length - 1];
    errors.push({
      line: lines.length,
      message: `unclosed zone "${zone.label}" (opened line ${zone.line})`,
      hint: 'close every zone with end',
    });
  }

  return { scopes, errors };
}
