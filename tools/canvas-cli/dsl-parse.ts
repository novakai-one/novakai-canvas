/**
 * Line-oriented DSL parser. Collects every error; never throws.
 *
 * The shape vocabulary — which keyword declares which node kind, and which child lines a node
 * may own — comes from the component registry, so a new shape is a registration, not an edit
 * here. Only grammar words are written down in this file: `scope`, `end`, `wire`, `type`, and
 * method lines. Each registered component parses its own parent and child statements.
 */

import type { DiagramComponent, DslChildStatement } from '../../src/components/component.ts';
import { allComponents } from '../../src/components/registry.ts';
import type { CanvasNode as RecordNode } from '../../src/domain/records.ts';
import {
  CONTAINER_ALIGNS, GRID_COLUMNS, SPACINGS, appearanceEntry, appearanceSpecification,
  canonicalNodeAppearance, isAppearanceKey, isArrangementKey, isPresentationAttributeKey,
  type AuthoredArrangement, type ParsedPresentation,
} from '../../src/domain/canvas-presentation.ts';

export interface ParseError { line: number; message: string; hint: string }
export interface InterfaceAst { name: string; accepts: string[]; returns: string[] }
export interface TypeAst { name: string; fields: string[] }
export interface NodeAst {
  kind: RecordNode['kind'];
  label: string;
  description?: string;
  /** Parent-declaration content owned by the registered component. */
  content: Record<string, unknown>;
  interfaces: InterfaceAst[];
  types: TypeAst[];
  /** Child-statement content, keyed by each statement's `contentKey` ('rows', 'steps', ...). */
  children: Record<string, unknown[]>;
  /** Authored presentation is compiled into the active layout, never into node content. */
  presentation?: ParsedPresentation;
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
  /** The authoritative mixed order of direct node and zone declarations. */
  declarations: (NodeAst | ZoneAst)[];
  presentation?: ParsedPresentation;
  line: number;
}
export interface ScopeAst {
  label: string;
  description?: string;
  nodes: NodeAst[];
  wires: WireAst[];
  zones: ZoneAst[];
  /** The authoritative mixed order of direct node and zone declarations. */
  declarations: (NodeAst | ZoneAst)[];
  presentation?: ParsedPresentation;
}

/** Parent statement keyword -> the component that parses it. */
const COMPONENTS = new Map<string, DiagramComponent>(
  allComponents().map((component) => [component.dslKeyword, component]),
);
const COMPONENTS_BY_KIND = new Map<string, DiagramComponent>(
  allComponents().map((component) => [component.kind, component]),
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

function attributeKey(token: string): string | undefined {
  const equals = token.indexOf('=');
  return equals < 1 ? undefined : token.slice(0, equals);
}

/** Strips and validates shared presentation tokens against their owning component metadata. */
function splitPresentation(
  component: DiagramComponent,
  tokens: string[],
): { semanticTokens: string[]; presentation?: ParsedPresentation } | { error: string; hint: string } {
  const appearanceKeys = component.appearanceKeys ?? [];
  const arrangementModes = component.arrangementModes ?? [];
  const owner = tokens[0];
  const layoutValues = arrangementModes.join('|');
  const columnsHint = arrangementModes.includes('grid') ? ' [columns=1|2|3|4|5|6]' : '';
  const hint = owner === 'scope'
    ? `scope "name" ["optional description"] [layout=${layoutValues}]${columnsHint} [gap=0|4|8|12|16|24|32] [align=stretch|start|center|end]`
    : component.declaration.syntax;
  const firstAttribute = tokens.findIndex((token, index) => {
    if (index < 2) return false;
    const key = attributeKey(token);
    return key !== undefined && isPresentationAttributeKey(key);
  });
  if (firstAttribute === -1) return { semanticTokens: tokens };

  const appearance: NonNullable<ParsedPresentation['appearance']> = {};
  const arrangement: Partial<AuthoredArrangement> = {};
  let hasArrangementAttribute = false;
  const seen = new Set<string>();
  for (const token of tokens.slice(firstAttribute)) {
    const equals = token.indexOf('=');
    const key = equals < 1 ? token : token.slice(0, equals);
    const raw = equals < 1 ? '' : token.slice(equals + 1);
    if (seen.has(key)) {
      return { error: `duplicate attribute "${key}"`, hint };
    }
    seen.add(key);

    if (isArrangementKey(key) && arrangementModes.length > 0) {
      hasArrangementAttribute = true;
      if (key === 'columns') {
        const columns = GRID_COLUMNS.find((candidate) => String(candidate) === raw);
        if (columns === undefined) {
          return { error: `invalid columns "${raw}"; use one of: ${GRID_COLUMNS.join(', ')}`, hint };
        }
        arrangement.columns = columns;
        continue;
      }
      if (key === 'layout') {
        const mode = arrangementModes.find((candidate) => candidate === raw);
        if (!mode) {
          return {
            error: `invalid layout "${raw}"; use one of: ${arrangementModes.join(', ')}`,
            hint,
          };
        }
        arrangement.layout = mode;
        continue;
      }
      if (key === 'gap') {
        const gap = SPACINGS.find((candidate) => String(candidate) === raw);
        if (gap === undefined) {
          return { error: `invalid gap "${raw}"; use one of: ${SPACINGS.join(', ')}`, hint };
        }
        arrangement.gap = gap;
        continue;
      }
      const align = CONTAINER_ALIGNS.find((candidate) => candidate === raw);
      if (!align) {
        return {
          error: `invalid align "${raw}"; use one of: ${CONTAINER_ALIGNS.join(', ')}`,
          hint,
        };
      }
      arrangement.align = align;
      continue;
    }

    if (isAppearanceKey(key) && appearanceKeys.includes(key)) {
      const entry = appearanceEntry(key, raw);
      if (!entry) {
        return {
          error: `invalid ${key} "${raw}"; use one of: ${appearanceSpecification(key).values.join(', ')}`,
          hint,
        };
      }
      (appearance as Record<string, unknown>)[entry.jsonKey] = entry.value;
      continue;
    }

    return {
      error: `unknown attribute "${key}" for ${owner}`,
      hint,
    };
  }

  if (hasArrangementAttribute && arrangement.layout === undefined) {
    return {
      error: `container columns, gap and align require layout=${layoutValues.replaceAll('|', ' or layout=')}`,
      hint,
    };
  }
  if (arrangement.layout === 'grid' && arrangement.columns === undefined) {
    return { error: 'layout=grid requires columns=1|2|3|4|5|6', hint };
  }
  if (arrangement.layout !== undefined
    && arrangement.layout !== 'grid' && arrangement.columns !== undefined) {
    return { error: 'columns is only valid with layout=grid', hint };
  }
  const parsed: ParsedPresentation = {};
  if (Object.keys(appearance).length > 0) parsed.appearance = canonicalNodeAppearance(appearance);
  if (arrangement.layout !== undefined) {
    parsed.arrangement = {
      layout: arrangement.layout,
      gap: arrangement.gap ?? 16,
      align: arrangement.align ?? 'stretch',
      ...(arrangement.columns === undefined ? {} : { columns: arrangement.columns }),
    };
  }
  return {
    semanticTokens: tokens.slice(0, firstAttribute),
    ...(Object.keys(parsed).length > 0 ? { presentation: parsed } : {}),
  };
}

/** Parses DSL source into scope ASTs plus every error found. */
export function parseDsl(source: string): { scopes: ScopeAst[]; errors: ParseError[] } {
  const scopes: ScopeAst[] = [];
  const errors: ParseError[] = [];
  let scope: ScopeAst | null = null;
  let node: NodeAst | null = null;
  let zoneStack: ZoneAst[] = [];

  /** Declarations attach to the innermost open zone, or the scope itself. */
  const declarationContainer = (): ScopeAst | ZoneAst =>
    zoneStack.length > 0 ? zoneStack[zoneStack.length - 1] : (scope as ScopeAst);

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
      const existing = node.children[child.statement.contentKey] ?? [];
      const validation = child.statement.validate?.(parsed.content, existing);
      if (validation) {
        fail(validation.error, validation.hint);
        continue;
      }
      (node.children[child.statement.contentKey] ??= []).push(parsed.content);
      continue;
    }

    if (line.startsWith('type ') && parseTypeLine(line)) {
      if (!node) {
        fail('type outside a node', 'declare a module/object first, then indent its types under it');
        continue;
      }
      if (COMPONENTS_BY_KIND.get(node.kind)?.allowsMembers === false) {
        fail(`${COMPONENTS_BY_KIND.get(node.kind)?.dslKeyword} does not accept methods or types`, 'use its published child statements instead');
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
      if (COMPONENTS_BY_KIND.get(node.kind)?.allowsMembers === false) {
        fail(`${COMPONENTS_BY_KIND.get(node.kind)?.dslKeyword} does not accept methods or types`, 'use its published child statements instead');
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
      const group = COMPONENTS_BY_KIND.get('group') as DiagramComponent;
      const split = splitPresentation(group, tokens);
      if ('error' in split) {
        fail(split.error, split.hint);
        continue;
      }
      if (zoneStack.length > 0 && scope) {
        fail(
          `unclosed zone "${zoneStack[zoneStack.length - 1].label}" (line ${zoneStack[zoneStack.length - 1].line}) before new scope`,
          'close every zone with end before starting a new scope',
        );
      }
      scope = {
        label: split.semanticTokens[1],
        ...(split.semanticTokens[2] === undefined ? {} : { description: split.semanticTokens[2] }),
        nodes: [], wires: [], zones: [], declarations: [],
        ...(split.presentation ? { presentation: split.presentation } : {}),
      };
      node = null;
      zoneStack = [];
      scopes.push(scope);
      continue;
    }

    const component = COMPONENTS.get(keyword);
    if (component) {
      if (!scope) {
        fail(`${keyword} outside a scope`, 'declare a scope first: scope "My System"');
        continue;
      }
      const split = splitPresentation(component, tokens);
      if ('error' in split) {
        fail(split.error, split.hint);
        continue;
      }
      const parsed = component.declaration.parse(split.semanticTokens);
      if ('error' in parsed) {
        fail(parsed.error, parsed.hint);
        continue;
      }
      if (component.layoutRole === 'container') {
        const zone: ZoneAst = {
          label: parsed.label,
          ...(parsed.description === undefined ? {} : { description: parsed.description }),
          nodes: [],
          zones: [],
          declarations: [],
          ...(split.presentation ? { presentation: split.presentation } : {}),
          line: lineNumber,
        };
        const container = declarationContainer();
        container.zones.push(zone);
        container.declarations.push(zone);
        zoneStack.push(zone);
        node = null;
        continue;
      }
      node = {
        kind: component.kind as NodeAst['kind'],
        label: parsed.label,
        ...(parsed.description === undefined ? {} : { description: parsed.description }),
        content: parsed.content ?? {},
        interfaces: [],
        types: [],
        children: {},
        ...(split.presentation ? { presentation: split.presentation } : {}),
      };
      const container = declarationContainer();
      container.nodes.push(node);
      container.declarations.push(node);
      if (!component.declaration.allowsBody) node = null;
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
