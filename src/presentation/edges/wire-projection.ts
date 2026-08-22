/** Projects semantic wires into React Flow edges. */

import { MarkerType, type Edge } from '@xyflow/react';
import {
  planWireRoutes, type Point, type RouteObstacle,
} from '../../domain/diagram-geometry';
import type { CanvasPreferences } from '../../domain/model';
import type { WireKind } from '../../domain/records';
import { ARCHITECTURE_FLOW } from '../../domain/flow';
import { resolveWireAppearance, wireStrokeWidth, type ResolvedWireAppearance } from '../wire-styles';
import type { ProjectionInput } from '../projection-contract';
import { connectedIds } from '../projection-selection';
import type { WireCardinality } from '../../domain/wire-cardinality';

/** How one wire is shaped by hand, read from the active layout route hint. */
export interface EdgeRoute {
  waypoints: { x: number; y: number }[];
  labelPosition?: number;
  points: Point[];
}

/** Presentation data required by elbow wires. */
export interface ArchitectureEdgeData extends Record<string, unknown> {
  label: string;
  kind: WireKind;
  preferences: CanvasPreferences;
  editable: boolean;
  select: () => void;
  route: EdgeRoute;
  obstacles: RouteObstacle[];
  setRoute?: (route: Partial<EdgeRoute>) => void;
  moveEnd?: (end: 'source' | 'target', nodeId: string, side?: string) => void;
  lane: number;
  appearance: ResolvedWireAppearance;
  sourceCardinality?: WireCardinality;
  targetCardinality?: WireCardinality;
}

/** Projects the visible wires of one diagram into React Flow edges. */
export function projectEdges(input: ProjectionInput): Edge<ArchitectureEdgeData>[] {
  const { editable, execute, preferences, record, select, selection, view } = input;
  const connected = connectedIds(input);
  const hints = record.layouts[record.views[record.activeViewId]?.layoutId]?.wireRouteHints ?? {};
  const plans = planWireRoutes(view, hints, {
    avoidObstacles: preferences.wires.avoidNodes ?? true,
  });
  const authoredAppearance = record.layouts[record.views[record.activeViewId]?.layoutId]
    ?.appearanceByWireId ?? {};
  return view.wires.map((wire) => {
    const plan = plans[wire.id];
    const appearance = resolveWireAppearance(wire.kind, authoredAppearance[wire.id], {
      theme: preferences.appearance.theme,
      fallbackWidth: wireStrokeWidth(preferences.wires.width),
      fallbackShape: preferences.wires.shape,
    });
    return ({
    id: wire.id,
    source: wire.source.nodeId,
    target: wire.target.nodeId,
    sourceHandle: plan?.sourceSide ?? ARCHITECTURE_FLOW.sourcePort,
    targetHandle: plan?.targetSide ?? ARCHITECTURE_FLOW.targetPort,
    type: 'elbow',
    selected: selection?.kind === 'wire' && selection.id === wire.id,
    zIndex: selection?.kind === 'wire' && selection.id === wire.id ? 1000 : 0,
    markerEnd: wire.source.cardinality || wire.target.cardinality ? undefined : {
      type: MarkerType.ArrowClosed,
      color: appearance.strokeColor,
      width: 14,
      height: 14,
    },
    className: preferences.wires.dimUnrelated && selection
      && (!connected.has(wire.source.nodeId) || !connected.has(wire.target.nodeId)) ? 'is-dimmed' : '',
    data: {
      label: wire.label,
      kind: wire.kind,
      preferences,
      editable,
      select: () => select({ kind: 'wire', id: wire.id }),
      lane: plan?.lane ?? 0,
      appearance,
      sourceCardinality: wire.source.cardinality,
      targetCardinality: wire.target.cardinality,
      route: {
        waypoints: hints[wire.id]?.waypoints ?? [],
        labelPosition: hints[wire.id]?.labelPosition,
        points: plan?.points ?? [],
      },
      obstacles: plan?.obstacles ?? [],
      setRoute: execute && editable
        ? (route: Partial<EdgeRoute>) => execute({ kind: 'wire.setRoute', id: wire.id, route })
        : undefined,
      moveEnd: execute && editable
        ? (end: 'source' | 'target', nodeId: string, side?: string) => {
          const isSide = side === 'top' || side === 'right' || side === 'bottom' || side === 'left';
          execute({
            kind: 'wire.reconnect',
            id: wire.id,
            source: end === 'source' ? nodeId : (wire.source.nodeId as string),
            target: end === 'target' ? nodeId : (wire.target.nodeId as string),
          });
          if (isSide) {
            execute({
              kind: 'wire.setRoute',
              id: wire.id,
              route: end === 'source'
                ? { preferredSourceSide: side }
                : { preferredTargetSide: side },
            });
          }
        }
        : undefined,
    },
    });
  });
}
