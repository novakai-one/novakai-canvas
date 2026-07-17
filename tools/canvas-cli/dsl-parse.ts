/** Line-oriented DSL parser. Collects every error; never throws. */

export interface ParseError { line: number; message: string; hint: string }
export interface InterfaceAst { name: string; accepts: string[]; returns: string[] }
export interface TypeAst { name: string; fields: string[] }
export interface NodeAst {
  kind: 'module' | 'object' | 'runtime' | 'resource' | 'comment';
  label: string;
  description?: string;
  interfaces: InterfaceAst[];
  types: TypeAst[];
}
export interface WireAst {
  source: string;
  target: string;
  contract: string;
  kind: 'owns' | 'references' | 'assigns' | 'queries' | 'executes';
  line: number;
}
export interface ScopeAst { label: string; description?: string; nodes: NodeAst[]; wires: WireAst[] }

const NODE_KEYWORDS = new Set(['module', 'object', 'runtime', 'resource']);
const WIRE_KINDS = new Set(['owns', 'references', 'assigns', 'queries', 'executes']);
const STATEMENTS = 'scope, module, object, runtime, resource, note, type, wire';

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
      scope = { label: tokens[1], description: tokens[2], nodes: [], wires: [] };
      node = null;
      scopes.push(scope);
      continue;
    }

    if (keyword === 'note') {
      if (!scope) {
        fail('note outside a scope', 'declare a scope first: scope "My System"');
        continue;
      }
      if (tokens.length < 2) {
        fail('note needs text', 'note "Why this shape is load-bearing."');
        continue;
      }
      scope.nodes.push({ kind: 'comment', label: tokens[1], interfaces: [], types: [] });
      node = null;
      continue;
    }

    if (NODE_KEYWORDS.has(keyword)) {
      if (!scope) {
        fail(`${keyword} outside a scope`, 'declare a scope first: scope "My System"');
        continue;
      }
      if (tokens.length < 2) {
        fail(`${keyword} needs a name`, `${keyword} "Session broker" "optional description"`);
        continue;
      }
      node = {
        kind: keyword as NodeAst['kind'],
        label: tokens[1],
        description: tokens[2],
        interfaces: [],
        types: [],
      };
      scope.nodes.push(node);
      continue;
    }

    fail(
      `unknown statement "${keyword}"`,
      `valid statements: ${STATEMENTS}; methods look like name(Input) -> Output under a node`,
    );
  }

  return { scopes, errors };
}
