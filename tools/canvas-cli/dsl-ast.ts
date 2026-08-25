import type { Orientation } from '../../src/domain/axis.ts';
import type { CanvasNode as RecordNode } from '../../src/domain/records.ts';
import type { ParsedPresentation } from '../../src/domain/canvas-presentation.ts';
import type { WireAst } from './wire-authoring.ts';

export type { WireAst } from './wire-authoring.ts';

/** One source error with a line and actionable correction. */
export interface ParseError { line: number; message: string; hint: string }
/** Method-like interface declaration owned by a node. */
export interface InterfaceAst { name: string; accepts: string[]; returns: string[] }
/** Named record-like type declaration owned by a node. */
export interface TypeAst { name: string; fields: string[] }
/** One registry-owned semantic node declaration. */
export interface NodeAst {
  kind: RecordNode['kind'];
  label: string;
  description?: string;
  /** Parent-declaration content owned by the registered component. */
  content: Record<string, unknown>;
  interfaces: InterfaceAst[];
  types: TypeAst[];
  /** Child-statement content, keyed by each statement's content key. */
  children: Record<string, unknown[]>;
  /** Authored presentation compiles into the active layout, never node content. */
  presentation?: ParsedPresentation;
}
/** A nested container inside a scope; compiles to a group node with parentId set. */
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
/** One fully declared map and its nested declarations. */
export interface ScopeAst {
  label: string;
  description?: string;
  /** Which way the whole map runs. Omitted means top-down. */
  orientation?: Orientation;
  nodes: NodeAst[];
  wires: WireAst[];
  zones: ZoneAst[];
  /** The authoritative mixed order of direct node and zone declarations. */
  declarations: (NodeAst | ZoneAst)[];
  presentation?: ParsedPresentation;
}
/** Complete parser output; syntax failures never escape as exceptions. */
export interface ParseResult { scopes: ScopeAst[]; errors: ParseError[] }
