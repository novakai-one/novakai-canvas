/** Projects semantic wires into React Flow edges. */

import { MarkerType, type Edge } from '@xyflow/react';
import type { CanvasPreferences } from '../../domain/model';
import type { PortSide, WireKind } from '../../domain/records';
import { ARCHITECTURE_FLOW } from '../../domain/flow';
import type { RouteObstacle } from './wire-routing';
import { chooseSides, laneOffsets, nodeRects, wireObstacles } from './wire-geometry';
import { resolveWireAppearance, wireStrokeWidth, type ResolvedWireAppearance } from '../wire-styles';
import type { ProjectionInput } from '../projection-contract';
import { connectedIds } from '../projection-selection';

/** How one wire is shaped by hand, read from the active layout route hint. */
export interface EdgeRoute {
  waypoints: { x: number; y: number }[];
  labelPosition?: number;
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
}

/** Projects the visible wires of one diagram into React Flow edges. */
export function projectEdges(input: ProjectionInput): Edge<ArchitectureEdgeData>[] {
  const { editable, execute, preferences, record, select, selection, view } = input;
  const connected = connectedIds(input);
  const lanes = laneOffsets(view.wires);
  const hints = record.layouts[record.views[record.activeViewId]?.layoutId]?.wireRouteHints ?? {};
  const authoredAppearance = record.layouts[record.views[record.activeViewId]?.layoutId]
    ?.appearanceByWireId ?? {};
  const rects = nodeRects(view);
  const sidesOf = new Map<string, { sourceSide: PortSide; targetSide: PortSide }>();
  const facing = (wire: typeof view.wires[number]) => {
    const cached = sidesOf.get(wire.id as string);
    if (cached) return cached;
    const source = rects.get(wire.source.nodeId as string);
    const target = rects.get(wire.target.nodeId as string);
    const resolved = source && target
      ? chooseSides(source, target, wireObstacles(view, rects, wire))
      : {
        sourceSide: ARCHITECTURE_FLOW.sourcePort as PortSide,
        targetSide: ARCHITECTURE_FLOW.targetPort as PortSide,
      };
    sidesOf.set(wire.id as string, resolved);
    return resolved;
  };
  return view.wires.map((wire) => {
    const appearance = resolveWireAppearance(wire.kind, authoredAppearance[wire.id], {
      theme: preferences.appearance.theme,
      fallbackWidth: wireStrokeWidth(preferences.wires.width),
    });
    return ({
    id: wire.id,
    source: wire.source.nodeId,
    target: wire.target.nodeId,
    sourceHandle: hints[wire.id]?.preferredSourceSide ?? facing(wire).sourceSide,
    targetHandle: hints[wire.id]?.preferredTargetSide ?? facing(wire).targetSide,
    type: 'elbow',
    selected: selection?.kind === 'wire' && selection.id === wire.id,
    zIndex: selection?.kind === 'wire' && selection.id === wire.id ? 1000 : 0,
    markerEnd: {
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
      lane: lanes.get(wire.id) ?? 0,
      appearance,
      route: {
        waypoints: hints[wire.id]?.waypoints ?? [],
        labelPosition: hints[wire.id]?.labelPosition,
      },
      obstacles: (preferences.wires.avoidNodes ?? true) ? wireObstacles(view, rects, wire) : [],
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
