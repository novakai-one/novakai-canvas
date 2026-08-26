import type { Orientation } from '../../contract/types/orientation.ts';
import type { CanvasNode as RecordNode } from '../../contract/records/index.ts';
import type { ParsedPresentation } from '../../contract/schemas/presentation.ts';
import type { WireAst } from './wires/wire-authoring.ts';

export type { WireAst } from './wires/wire-authoring.ts';

/** One source error with a line and actionable correction. */
export interface ParseError { line: number; message: string; hint: string }
/** Method-like interface declaration owned by a node. */
export interface InterfaceAst { name: string; accepts: string[]; returns: string[] }
/** Named record-like type declaration owned by a node. */
export interface TypeAst { name: string; fields: string[] }
/** One source-located wire reference in a named flow; label overrides the wire's label on badges. */
export interface FlowStepAst { ordinal: number; ref: string; label?: string; line: number }
/** A scope-level semantic overlay; never part of the node declaration tree. */
export interface FlowAst {
  label: string;
  id?: string;
  steps: FlowStepAst[];
  line: number;
}
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
  /** Declared rank along the axis; parsed from `band=`, leaf nodes only. */
  band?: number;
  /** Declared column across the axis; parsed from `lane=`, leaf nodes only. */
  lane?: number;
  /** Authored presentation compiles into the active layout, never node content. */
  presentation?: ParsedPresentation;
}
/** A nested container inside a scope; compiles to a group node with parentId set. */
export interface ZoneAst {
  label: string;
  description?: string;
  /** Optional membrane policy; absence means this is an ordinary visual container. */
  crossing?: 'gated' | 'free';
  /** Author-facing label resolved to a durable NodeId by the scope compiler. */
  gateLabel?: string;
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
  flows: FlowAst[];
  zones: ZoneAst[];
  /** The authoritative mixed order of direct node and zone declarations. */
  declarations: (NodeAst | ZoneAst)[];
  presentation?: ParsedPresentation;
}
/** Complete parser output; syntax failures never escape as exceptions. */
export interface ParseResult { scopes: ScopeAst[]; errors: ParseError[] }
