import type { DiagramRecord } from '../../../src/domain/records.ts';
import type { PlannedWireRoute } from '../../../src/domain/diagram-geometry.ts';
import type { PlacedNode } from '../record-graph.ts';
import type { Crossing, Topology } from '../../../src/domain/topology.ts';
import type { Emphasis, FlowLibrary } from '../../../src/domain/flows.ts';
import type { FlowId } from '../../../src/domain/ids.ts';

interface Point { x: number; y: number }

/** Geometry and ordered content shared by the snapshot rendering phases. */
export interface SnapshotScene {
  nodes: Record<string, PlacedNode>;
  scopeId: string;
  scope: PlacedNode;
  layout: DiagramRecord['layouts'][string];
  descendants: PlacedNode[];
  wires: DiagramRecord['wires'][string][];
  panel: { x: number; y: number; width: number; height: number };
  total: { width: number; height: number };
  routes: Record<string, PlannedWireRoute>;
  topology: Topology;
  crossings: readonly Crossing[];
  flows: FlowLibrary;
  activeFlowId?: FlowId;
  emphasis: Record<string, Emphasis>;
  routeOffset: Point;
  positionOf(id: string): Point;
}
