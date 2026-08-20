/**
 * The diagram component contract.
 *
 * Every node kind (`group`, `module`, `tree`, ...) implements this once and registers itself in
 * `registry.ts`. Everything that today hardcodes "which kinds exist" — schemas, the DSL, the
 * layout engine, the web renderers — reads the registry instead, so adding a kind is one folder
 * plus one registration line rather than an edit to a dozen files.
 *
 * This module (and every `component.ts`) must stay importable from plain Node with type
 * stripping: no React, no `node:*` builtins. The Vite app and the CLI both load it.
 */

import type { CanvasNode as RecordNode } from '../domain/records.ts';
import type {
  AppearanceKey, LayoutMode, ResolvedNodeAppearance,
} from '../domain/canvas-presentation.ts';

export interface Size { width: number; height: number }

/** Semantic fields produced by one component-owned parent declaration. */
export interface DslNodeContent {
  label: string;
  description?: string;
  content?: Record<string, unknown>;
}

/** A component parent declaration either parses fully or explains the exact correction. */
export type DslNodeParseResult = DslNodeContent | { error: string; hint: string };

/** Machine-readable parent declaration used by parse, print, help, and capability discovery. */
export interface DslNodeDeclaration {
  syntax: string;
  example: string;
  allowsBody: boolean;
  parse(tokens: string[]): DslNodeParseResult;
  print(node: RecordNode): string;
}

/** Statement lines a component's node may own in the DSL (e.g. tree's `row`, timeline's `step`). */
export interface DslChildStatement {
  keyword: string;                       // 'row', 'step'
  syntax: string;
  example: string;
  /** The node field the parsed content collects into ('rows', 'steps') — must match a key in `contentFields`. */
  contentKey: string;
  parse(tokens: string[], line: number): { content: unknown } | { error: string; hint: string };
  /** Optional stateless collection rule, evaluated against earlier siblings before insertion. */
  validate?(
    content: unknown,
    existingSiblings: readonly unknown[],
  ): { error: string; hint: string } | undefined;
  print(node: RecordNode): string[];     // lines under the node statement, 2-space indented
}

/** One selectable child owned by a component node, with fields the inspector only displays. */
export interface ComponentItem {
  /** The component-owned node field that contains this item (for example, `rows` or `steps`). */
  collection: string;
  /** Stable identity within the collection. */
  id: string;
  /** Human-readable item category shown by the inspector. */
  kind: string;
  /** Human-readable item name shown by the inspector and its trail. */
  label: string;
  /** Read-only details the shared inspector presents for this item. */
  fields: readonly { label: string; value: string }[];
}

export interface DiagramComponent<K extends string = string> {
  /** Durable id stored in records. Never renamed once shipped. */
  kind: K;
  /** DSL statement keyword that declares this node (usually === kind). */
  dslKeyword: string;
  /** The sole owner of this component's parent-statement grammar. */
  declaration: DslNodeDeclaration;
  /** Extra zod fields this kind stores beyond the base node (id/kind/label/description/parentId). */
  contentFields?: Record<string, import('zod').ZodTypeAny>;
  dslChildren?: DslChildStatement[];
  /** Shared presentation keys this kind accepts from agent-authored DSL. */
  appearanceKeys?: readonly AppearanceKey[];
  /** Ordered-container modes this kind accepts from agent-authored DSL. */
  arrangementModes?: readonly LayoutMode[];
  /** Optional identity policy; absent means the existing map-wide, wire-addressable namespace. */
  identity?: {
    scope: 'parent';
    namespace: string;
    wireEndpoint: boolean;
    preserveDeclarationOrder?: boolean;
  };
  /** False when this node's body accepts only its component-owned child statements. */
  allowsMembers?: boolean;
  /** Selectable children owned by this component node. */
  items?(node: RecordNode): readonly ComponentItem[];
  layoutRole: 'leaf' | 'container';
  /** Content-driven size for auto-layout. ctx gives interface/type lines already resolved. */
  measure(node: RecordNode, ctx: {
    interfaceLines: string[];
    typeLines: string[];
    appearance: ResolvedNodeAppearance;
  }): Size;
  /** SVG body for `./canvas snapshot`. Return undefined to use the shared card renderer. */
  renderSvg?(
    node: RecordNode,
    box: { x: number; y: number; width: number; height: number },
    appearance: ResolvedNodeAppearance,
  ): string;
}

function quote(value: string): string {
  return `"${value}"`;
}

/** Creates the existing `keyword name [description]` declaration without duplicating grammar. */
export function namedNodeDeclaration(
  keyword: string,
  exampleLabel: string,
  exampleDescription?: string,
): DslNodeDeclaration {
  const syntax = `${keyword} "name" ["optional description"]`;
  const example = `${keyword} ${quote(exampleLabel)}`
    + `${exampleDescription ? ` ${quote(exampleDescription)}` : ''}`;
  return {
    syntax,
    example,
    allowsBody: true,
    parse(tokens) {
      if (tokens.length < 2) return { error: `${keyword} needs a name`, hint: example };
      return { label: tokens[1], ...(tokens[2] === undefined ? {} : { description: tokens[2] }) };
    },
    print(node) {
      return `${keyword} ${quote(node.label)}${node.description ? ` ${quote(node.description)}` : ''}`;
    },
  };
}

/** Creates a text-only declaration such as `note`; it cannot own nested DSL lines. */
export function textNodeDeclaration(
  keyword: string,
  exampleText: string,
): DslNodeDeclaration {
  const syntax = `${keyword} "text"`;
  const example = `${keyword} ${quote(exampleText)}`;
  return {
    syntax,
    example,
    allowsBody: false,
    parse(tokens) {
      if (tokens.length < 2) return { error: `${keyword} needs text`, hint: example };
      return { label: tokens[1] };
    },
    print(node) {
      return `${keyword} ${quote(node.label)}`;
    },
  };
}
