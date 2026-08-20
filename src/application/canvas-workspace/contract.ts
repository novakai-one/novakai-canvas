import type { CanvasActor, CanvasProvenance } from '../../domain/model.ts';
import type { ContainerArrangement, NodeAppearance } from '../../domain/canvas-presentation.ts';
import type { DiagramRecord, PortSide } from '../../domain/records.ts';

/** Who is acting and through which surface. Supplied by the host, never by a caller payload. */
export interface ActorContext {
  actor: CanvasActor;
  provenance: CanvasProvenance;
}

interface PlacementInput {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/** A partial wire route update; omitted fields retain their stored value. */
interface RouteInput {
  waypoints?: { x: number; y: number }[];
  /** 0 at the source end, 1 at the target end. */
  labelPosition?: number;
  preferredSourceSide?: PortSide;
  preferredTargetSide?: PortSide;
}

/** Every mutation the capability accepts. Hosts compose these; they never edit records. */
export type RecordCommand =
  | { kind: 'node.add'; node: DiagramRecord['nodes'][string]; placement: PlacementInput }
  | { kind: 'node.move'; id: string; position: { x: number; y: number } }
  | { kind: 'node.resize'; id: string; size: { width: number; height: number } }
  | { kind: 'node.pin'; id: string; pinned: boolean }
  | { kind: 'node.update'; id: string; patch: { label?: string; description?: string } }
  | { kind: 'node.reparent'; id: string; parentId?: string }
  | { kind: 'node.remove'; id: string }
  | { kind: 'wire.add'; wire: DiagramRecord['wires'][string] }
  | { kind: 'wire.reconnect'; id: string; source?: string; target?: string }
  | { kind: 'wire.setRoute'; id: string; route: RouteInput }
  | {
    kind: 'wire.update';
    id: string;
    patch: { label?: string; kind?: DiagramRecord['wires'][string]['kind'] };
  }
  | { kind: 'wire.remove'; id: string }
  | { kind: 'interface.add'; ownerId: string; iface: DiagramRecord['interfaces'][string] }
  | {
    kind: 'interface.update';
    id: string;
    patch: { name?: string; accepts?: string[]; returns?: string[] };
  }
  | { kind: 'interface.remove'; id: string }
  | { kind: 'view.setCollapsed'; id: string; collapsed: boolean }
  | { kind: 'view.setViewport'; viewport: { x: number; y: number; zoom: number } }
  | {
    kind: 'layout.presentation.replace';
    appearanceByNodeId: Record<string, NodeAppearance>;
    arrangementByContainerId: Record<string, ContainerArrangement>;
  }
  | { kind: 'diagram.rename'; name: string };

/** A batch of intentions applied as one revision, or not at all. */
export interface RecordChangeSet {
  operationId: string;
  expectedRevision: number;
  timestamp: string;
  commands: RecordCommand[];
}

/** What happened to a submitted batch. Every failure is named, none are exceptions. */
export type ChangeOutcome =
  | { status: 'applied'; revision: number; commandsApplied: number }
  | { status: 'duplicate'; originalRevision: number; revision: number }
  | { status: 'conflict'; expectedRevision: number; actualRevision: number }
  | { status: 'rejected'; reason: string; commandIndex?: number };

/** One opened diagram's authority over its own content, revision, and history. */
export interface CanvasWorkspace {
  snapshot(): DiagramRecord;
  submit(changeSet: RecordChangeSet): ChangeOutcome;
  /** Convenience for host interactions; wraps one command in a fully attributed batch. */
  execute(command: RecordCommand): ChangeOutcome;
  canUndo(): boolean;
  undo(): boolean;
  subscribe(listener: () => void): () => void;
}
