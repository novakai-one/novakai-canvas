import type { Orientation } from './types/orientation.ts';
/** Typed mutation vocabulary accepted by CanvasWorkspace. */

import type {
  AuthoredArrangement, ContainerArrangement, NodeAppearance,
} from './schemas/presentation.ts';
import type { WireAppearance } from './schemas/wire-appearance.ts';
import type { DiagramRecord, PortAnchor, PortSide } from './records/index.ts';
import type { WireCardinality } from './schemas/wire-cardinality.ts';
import type { FlowId } from './brands.ts';

interface PlacementInput {
  position: { x: number; y: number };
  size: { width: number; height: number };
  sizeMode?: 'auto' | 'manual';
}

/** A partial wire route update; omitted fields retain their stored value. */
interface RouteInput {
  waypoints?: { x: number; y: number }[];
  /** 0 at the source end, 1 at the target end. */
  labelPosition?: number;
  /** `null` removes the stored preference; omission preserves it. */
  preferredSourceSide?: PortSide | null;
  /** `null` removes the stored preference; omission preserves it. */
  preferredTargetSide?: PortSide | null;
}

/** Every mutation the capability accepts. Hosts compose these; they never edit records. */
export type RecordCommand =
  | { kind: 'node.add'; node: DiagramRecord['nodes'][string]; placement: PlacementInput }
  | { kind: 'node.move'; id: string; position: { x: number; y: number } }
  | {
    kind: 'node.resize'; id: string; size: { width: number; height: number };
    /** UI drags say manual; automatic layout omits this and preserves current authority. */
    sizeMode?: 'auto' | 'manual';
  }
  | { kind: 'node.autoSize'; id: string }
  | { kind: 'node.pin'; id: string; pinned: boolean }
  | { kind: 'node.update'; id: string; patch: { label?: string; description?: string } }
  | { kind: 'node.content.set'; id: string; field: string; value: unknown }
  | { kind: 'node.reparent'; id: string; parentId?: string }
  | { kind: 'node.remove'; id: string }
  | { kind: 'wire.add'; wire: DiagramRecord['wires'][string] }
  | {
    kind: 'wire.reconnect'; id: string; source?: string; target?: string;
    /** `null` chooses the ordinary node endpoint; omission preserves unless its node changes. */
    sourceAnchor?: PortAnchor | null; targetAnchor?: PortAnchor | null;
  }
  | { kind: 'wire.setRoute'; id: string; route: RouteInput }
  | {
    kind: 'wire.setCardinality'; id: string;
    /** `null` removes one end; omission preserves it. */
    source?: WireCardinality | null; target?: WireCardinality | null;
  }
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
  | { kind: 'flow.activate'; flowId?: FlowId }
  | {
    kind: 'layout.presentation.replace';
    appearanceByNodeId: Record<string, NodeAppearance>;
    appearanceByWireId: Record<string, WireAppearance>;
    arrangementByContainerId: Record<string, ContainerArrangement>;
  }
  | { kind: 'layout.nodeAppearance.set'; id: string; appearance: NodeAppearance }
  | { kind: 'layout.wireAppearance.set'; id: string; appearance: WireAppearance }
  | { kind: 'layout.arrangement.set'; id: string; arrangement?: AuthoredArrangement }
  | {
    kind: 'diagram.definitions.replace';
    interfaces: DiagramRecord['interfaces']; types: DiagramRecord['types'];
  }
  | { kind: 'diagram.flows.replace'; flows: NonNullable<DiagramRecord['flows']> }
  | { kind: 'diagram.rename'; name: string }
  | { kind: 'diagram.setOrientation'; orientation?: Orientation };
