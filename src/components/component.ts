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

export interface Size { width: number; height: number }

/** Statement lines a component's node may own in the DSL (e.g. tree's `row`, timeline's `step`). */
export interface DslChildStatement {
  keyword: string;                       // 'row', 'step'
  parse(tokens: string[], line: number): { content: unknown } | { error: string; hint: string };
  print(node: RecordNode): string[];     // lines under the node statement, 2-space indented
}

export interface DiagramComponent<K extends string = string> {
  /** Durable id stored in records. Never renamed once shipped. */
  kind: K;
  /** DSL statement keyword that declares this node (usually === kind). */
  dslKeyword: string;
  /** Extra zod fields this kind stores beyond the base node (id/kind/label/description/parentId). */
  contentFields?: Record<string, import('zod').ZodTypeAny>;
  dslChildren?: DslChildStatement[];
  layoutRole: 'leaf' | 'container';
  /** Content-driven size for auto-layout. ctx gives interface/type lines already resolved. */
  measure(node: RecordNode, ctx: { interfaceLines: string[]; typeLines: string[] }): Size;
  /** SVG body for `./canvas snapshot`. Return undefined to use the shared card renderer. */
  renderSvg?(node: RecordNode, box: { x: number; y: number; width: number; height: number }): string;
}
