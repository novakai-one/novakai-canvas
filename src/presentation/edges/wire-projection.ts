/** Projects semantic wires into React Flow edges. */

import { MarkerType, type Edge } from '@xyflow/react';
import {
  planWireRoutes, type Point, type RouteObstacle,
} from '@novakai/canvas';
import type { CanvasPreferences } from '@novakai/canvas';
import type { WireKind } from '@novakai/canvas';
import { orientationOf, resolveAxis } from '@novakai/canvas';
import { resolveWireAppearance, wireStrokeWidth, type ResolvedWireAppearance } from '@novakai/canvas';
import type { ProjectionInput } from '../projection-contract';
import { connectedIds, connectedWireIds } from '../projection-selection';
import type { WireCardinality } from '@novakai/canvas';
import { compileTopology, crossingsOf } from '@novakai/canvas';
import { portHandleId } from '@novakai/canvas';
import { compileFlows, wireEmphasis, type Emphasis } from '@novakai/canvas';

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
  lane: number;
  appearance: ResolvedWireAppearance;
  sourceCardinality?: WireCardinality;
  targetCardinality?: WireCardinality;
  related: boolean;
  emphasis: Emphasis;
  flowActive: boolean;
}

/** Projects the visible wires of one diagram into React Flow edges. */
export function projectEdges(input: ProjectionInput): Edge<ArchitectureEdgeData>[] {
  const { editable, execute, preferences, record, select, selection, view } = input;
  const connected = connectedIds(input);
  const connectedWires = connectedWireIds(input);
  const topology = compileTopology(record);
  const flows = compileFlows(record);
  const activeFlowId = record.views[record.activeViewId]?.flowId;
  const emphasis = wireEmphasis(flows, activeFlowId, view.wires.map((wire) => wire.id));
  const boundaryById = new Map(topology.boundaries.map((boundary) => [boundary.nodeId, boundary]));
  const crossingsByWire = new Map<string, ReturnType<typeof crossingsOf>>();
  for (const crossing of crossingsOf(record, topology)) {
    crossingsByWire.set(
      crossing.wireId as string,
      [...(crossingsByWire.get(crossing.wireId as string) ?? []), crossing],
    );
  }
  const hints = record.layouts[record.views[record.activeViewId]?.layoutId]?.wireRouteHints ?? {};
  const axis = resolveAxis(orientationOf(record));
  const plans = planWireRoutes(view, hints, {
    axis,
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
    const related = selection !== null && connectedWires.has(wire.id as string);
    const crossings = crossingsByWire.get(wire.id as string) ?? [];
    const bypassesGate = crossings.some((crossing) =>
      boundaryById.get(crossing.boundaryId)?.crossing === 'gated' && crossing.gateNodeId === null);
    return ({
    id: wire.id,
    source: wire.source.nodeId,
    target: wire.target.nodeId,
    sourceHandle: wire.source.anchor
      ? portHandleId(wire.source.anchor) : plan?.sourceSide ?? axis.sourcePort,
    targetHandle: wire.target.anchor
      ? portHandleId(wire.target.anchor) : plan?.targetSide ?? axis.targetPort,
    type: 'elbow',
    selected: selection?.kind === 'wire' && selection.id === wire.id,
    zIndex: selection?.kind === 'wire' && selection.id === wire.id ? 1000 : 0,
    markerEnd: wire.source.cardinality || wire.target.cardinality ? undefined : {
      type: MarkerType.ArrowClosed,
      color: appearance.strokeColor,
      width: 14,
      height: 14,
    },
    className: [
      activeFlowId ? `has-flow-${emphasis[wire.id]}` : '',
      related ? 'is-related' : '',
      crossings.length > 0 ? 'is-crossing' : '',
      bypassesGate ? 'is-crossing-bypass' : '',
      preferences.wires.dimUnrelated && selection
        && (!connected.has(wire.source.nodeId) || !connected.has(wire.target.nodeId))
        ? 'is-dimmed' : '',
    ].filter(Boolean).join(' '),
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
      related,
      emphasis: emphasis[wire.id],
      flowActive: activeFlowId !== undefined,
      route: {
        waypoints: hints[wire.id]?.waypoints ?? [],
        labelPosition: hints[wire.id]?.labelPosition,
        points: plan?.points ?? [],
      },
      obstacles: plan?.obstacles ?? [],
      setRoute: execute && editable
        ? (route: Partial<EdgeRoute>) => execute({ kind: 'wire.setRoute', id: wire.id, route })
        : undefined,
    },
    });
  });
}
