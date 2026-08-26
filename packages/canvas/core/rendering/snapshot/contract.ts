import type { DiagramRecord } from '../../../contract/records/index.ts';
import type { PlannedWireRoute } from '../../domain/diagram-geometry.ts';
import type { PlacedNode } from '../../authoring/records/record-graph.ts';
import type { Crossing, Topology } from '../../domain/topology.ts';
import type { Emphasis, FlowLibrary } from '../../domain/flows.ts';
import type { FlowId } from '../../../contract/brands.ts';
import type { ResolvedCanvasTheme } from '../../../contract/records/preferences.ts';
import type { SnapshotStyle } from './svg.ts';

interface Point { x: number; y: number }

/** Geometry and ordered content shared by the snapshot rendering phases. */
export interface SnapshotScene {
  theme: ResolvedCanvasTheme;
  style: SnapshotStyle;
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
