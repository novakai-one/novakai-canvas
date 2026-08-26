import type { DiagramRecord } from '../../../contract/records/index.ts';
import { contentFieldsFor } from '../../components/registry.ts';
import { placementsOf, type RecordNode } from './record-graph.ts';

export function depthOf(nodes: Record<string, RecordNode>, id: string): number {
  let depth = 0;
  let cursor = nodes[id]?.parentId as string | undefined;
  while (cursor && depth < 64) {
    depth += 1;
    cursor = nodes[cursor]?.parentId as string | undefined;
  }
  return depth;
}

export function structurallyEqual(left: RecordNode, right: RecordNode): boolean {
  const componentContentMatches = left.kind === right.kind
    && Object.keys(contentFieldsFor(left.kind)).every((field) =>
      JSON.stringify((left as unknown as Record<string, unknown>)[field] ?? null)
      === JSON.stringify((right as unknown as Record<string, unknown>)[field] ?? null));
  return left.kind === right.kind
    && left.parentId === right.parentId
    && left.band === right.band
    && left.lane === right.lane
    && left.crossing === right.crossing
    && left.gate === right.gate
    && JSON.stringify(left.interfaceIds) === JSON.stringify(right.interfaceIds)
    && JSON.stringify(left.typeIds) === JSON.stringify(right.typeIds)
    && componentContentMatches
    && JSON.stringify(left.subjectRef ?? null) === JSON.stringify(right.subjectRef ?? null)
    && left.expandsToDiagramId === right.expandsToDiagramId;
}

export function sameWires(left: DiagramRecord['wires'], right: DiagramRecord['wires']): boolean {
  const key = (wires: DiagramRecord['wires']): string => JSON.stringify(
    Object.values(wires)
      .map((wire) => [wire.id, wire.kind, wire.label, wire.source, wire.target])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
  return key(left) === key(right);
}

export function sameDefinitions(left: DiagramRecord, right: DiagramRecord): boolean {
  return JSON.stringify(left.interfaces) === JSON.stringify(right.interfaces)
    && JSON.stringify(left.types) === JSON.stringify(right.types);
}

export function sameFlows(left: DiagramRecord, right: DiagramRecord): boolean {
  return JSON.stringify(left.flows ?? {}) === JSON.stringify(right.flows ?? {});
}

export function activeFlow(record: DiagramRecord): string | undefined {
  return record.views[record.activeViewId]?.flowId as string | undefined;
}

export function activeLayout(record: DiagramRecord): DiagramRecord['layouts'][string] {
  return record.layouts[record.views[record.activeViewId].layoutId];
}

export function presentationOf(record: DiagramRecord) {
  const layout = activeLayout(record);
  return {
    appearanceByNodeId: layout.appearanceByNodeId ?? {},
    appearanceByWireId: layout.appearanceByWireId ?? {},
    arrangementByContainerId: layout.arrangementByContainerId ?? {},
  };
}

export function placementInput(placement: ReturnType<typeof placementsOf>[string]) {
  return {
    position: placement.position,
    size: placement.size,
    ...(placement.sizeMode ? { sizeMode: placement.sizeMode } : {}),
  };
}
