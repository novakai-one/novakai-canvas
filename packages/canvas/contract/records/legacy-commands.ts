import type {
  ArchitectureDocument, CanvasDiagram, CanvasLayout, CanvasNode, CanvasWire,
  LayoutProposal, NodeKind, NodePlacement, WireKind,
} from './legacy-document.ts';
import type { CanvasReference, SourceReference } from './architecture.ts';
import type {
  CanvasActor, CanvasCommandKind, CanvasProvenance,
} from './legacy-operation.ts';
import type { Position, Size } from '../types/spatial.ts';

/** Complete set of supported V2 document intentions. */
export type CanvasCommand =
  | { kind: 'diagram.create'; diagram: CanvasDiagram; root: CanvasNode; placement: NodePlacement }
  | { kind: 'diagram.setStatus'; id: string; status: CanvasDiagram['status'] }
  | { kind: 'diagram.setReferences'; id: string; subjectRef?: CanvasReference; sourceRefs: SourceReference[] }
  | { kind: 'node.add'; node: CanvasNode; placement: NodePlacement }
  | { kind: 'node.move'; id: string; position: Position; layoutId?: string }
  | { kind: 'node.resize'; id: string; size: Size; layoutId?: string }
  | { kind: 'node.pin'; id: string; pinned: boolean; layoutId?: string }
  | { kind: 'node.update'; id: string; patch: Partial<Pick<CanvasNode, 'label' | 'description' | 'kind'>> }
  | { kind: 'node.setSubject'; id: string; subjectRef?: CanvasReference }
  | { kind: 'node.setDetailDiagram'; id: string; diagramId?: string }
  | { kind: 'node.reparent'; id: string; parentId: string }
  | { kind: 'node.setCollapsed'; id: string; collapsed: boolean; layoutId?: string }
  | { kind: 'node.remove'; id: string }
  | { kind: 'wire.add'; wire: CanvasWire }
  | { kind: 'wire.update'; id: string; patch: Partial<Pick<CanvasWire, 'label' | 'kind'>> }
  | { kind: 'wire.reconnect'; id: string; source: string; target: string }
  | { kind: 'wire.remove'; id: string }
  | { kind: 'layout.apply'; proposal: LayoutProposal }
  | { kind: 'scope.layout'; id: string; layoutId?: string; groupPadding?: number };

/** One all-or-nothing public edit shared by human and agent hosts. */
export interface CanvasChangeSet {
  operationId: string;
  expectedRevision: number;
  actor: CanvasActor;
  timestamp: string;
  provenance: CanvasProvenance;
  commands: CanvasCommand[];
}

export type CanvasChangeOutcome =
  | { status: 'applied'; operationId: string; revision: number; commandsApplied: number }
  | { status: 'duplicate'; operationId: string; originalRevision: number; revision: number }
  | { status: 'conflict'; operationId: string; expectedRevision: number; actualRevision: number }
  | { status: 'rejected'; operationId: string; reason: string; commandIndex?: number };

/** Whole-document import seam used by compilers while the capability remains revision authority. */
export interface CanvasImportSet {
  operationId: string;
  expectedRevision: number;
  actor: CanvasActor;
  timestamp: string;
  provenance: CanvasProvenance;
  document: ArchitectureDocument;
}

/** Machine-readable vocabulary so an unfamiliar host does not inspect UI source. */
export interface CanvasCapabilityDescription {
  schemaVersion: ArchitectureDocument['schemaVersion'];
  revision: number;
  nodeKinds: NodeKind[];
  nodeAliases: Record<string, NodeKind>;
  wireKinds: WireKind[];
  layoutTargets: Array<'diagram' | 'group' | 'nodes'>;
  layoutStrategies: CanvasLayout['strategy'][];
  commandKinds: Array<PinnedCommandKind | 'document.import'>;
}

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type PinnedCommandKind = Exact<CanvasCommand['kind'], CanvasCommandKind> extends true
  ? CanvasCommand['kind'] : never;
