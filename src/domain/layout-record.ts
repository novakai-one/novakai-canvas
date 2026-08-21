import type { LayoutId, NodeId, ViewId, WireId } from './ids.ts';
import type { Position, Size } from './model.ts';
import type { ContainerArrangement, NodeAppearance } from './canvas-presentation.ts';
import type { WireAppearance } from './wire-appearance.ts';

/** Which edge of a node an endpoint attaches to. */
export type PortSide = 'top' | 'right' | 'bottom' | 'left';

/** Named arrangement algorithms. `manual` is the identity strategy: it moves nothing. */
export type LayoutStrategyName = 'manual' | 'hierarchy' | 'flow';

/** One node's geometry inside one saved layout. */
export interface NodePlacement {
  nodeId: NodeId;
  position: Position;
  size: Size;
  /** Absent/auto follows component measurement; manual preserves the user's dragged size. */
  sizeMode?: 'auto' | 'manual';
  /** A pinned node is an anchor: layout works around it and never moves it. */
  pinned: boolean;
}

/** Durable routing preference. Never a renderer path string, so the renderer stays replaceable. */
export interface WireRouteHint {
  wireId: WireId;
  preferredSourceSide?: PortSide;
  preferredTargetSide?: PortSide;
  waypoints: Position[];
  /** A fraction along the wire: 0 at the source, 1 at the target. */
  labelPosition?: number;
}

/** One named arrangement of one diagram's nodes. */
export interface CanvasLayout {
  id: LayoutId;
  name: string;
  strategy: LayoutStrategyName;
  placements: Record<string, NodePlacement>;
  wireRouteHints: Record<string, WireRouteHint>;
  /** Authored presentation belongs to this arrangement, never to semantic nodes. */
  appearanceByNodeId?: Record<string, NodeAppearance>;
  appearanceByWireId?: Record<string, WireAppearance>;
  arrangementByContainerId?: Record<string, ContainerArrangement>;
}

/** Geometry and reading-state identity shared by saved canvas views. */
export interface CanvasViewBase {
  id: ViewId;
  name: string;
  layoutId: LayoutId;
  viewport: { x: number; y: number; zoom: number };
  collapsedNodeIds: NodeId[];
}
