import type { Orientation } from '../../../src/domain/axis.ts';
import type { CrossDiagramLink, DiagramRecord } from '../../../src/canvas.ts';
import type { ContainerArrangement, NodeAppearance } from '../../../src/domain/canvas-presentation.ts';
import type { WireAppearance } from '../../../src/domain/wire-appearance.ts';
import type { ScopeAst } from '../dsl-ast.ts';
import type { RecordNode, RecordWire } from '../record-graph.ts';
import type { CrossDiagramWire, LinkEnd } from '../wire-authoring.ts';

export type { CrossDiagramWire, LinkEnd } from '../wire-authoring.ts';

/** A refusal to compile, always paired with the fix that would make it compile. */
export interface CompileError { message: string; hint: string; line?: number }

/** One diagram's complete content, exactly as its scope block declares it. */
export interface CompiledDiagram {
  /** Reuses the existing record's id when the scope already exists, so identity survives. */
  id: string;
  name: string;
  /** Declared on the root scope. Omitted here means omitted in the file. */
  orientation?: Orientation;
  rootNodeId: string;
  nodes: Record<string, RecordNode>;
  wires: Record<string, RecordWire>;
  interfaces: DiagramRecord['interfaces'];
  types: DiagramRecord['types'];
  appearanceByNodeId: Record<string, NodeAppearance>;
  appearanceByWireId: Record<string, WireAppearance>;
  arrangementByContainerId: Record<string, ContainerArrangement>;
  /** Wires the record cannot hold because a wire belongs to exactly one diagram. */
  crossDiagramWires: CrossDiagramWire[];
}

/** Everything one `./canvas apply` compiled, including refusals and warnings. */
export interface CompileResult {
  diagrams: CompiledDiagram[];
  errors: CompileError[];
  warnings: string[];
  /** Diagram ids that did not exist before this compile. */
  createdDiagramIds: string[];
}

/** One declared scope paired with the durable identity it will use. */
export interface DeclaredScope {
  scopeAst: ScopeAst;
  record?: DiagramRecord;
  id: string;
  rootNodeId: string;
}

/** Existing nodes outside the scopes being replaced, indexed for wire resolution. */
export interface ForeignCatalog {
  ends: Map<string, LinkEnd[]>;
  labels: Map<string, string>;
}

/** Shared diagnostic sinks preserve declaration order across compilation phases. */
export interface CompileMessages {
  errors: CompileError[];
  warnings: string[];
}

/** Compiled semantic content plus private label indexes needed by wire compilation. */
export interface CompiledScope {
  declared: DeclaredScope;
  diagram: CompiledDiagram;
  endpointByLabelSlug: Map<string, string[]>;
  endpointByRef: Map<string, string>;
  endpointById: Map<string, string>;
  localLabels: Map<string, string>;
}

/** All inputs wire resolution needs without exposing scope-compilation internals. */
export interface WireCompileContext {
  foreign: ForeignCatalog;
  links: CrossDiagramLink[];
  messages: CompileMessages;
}
