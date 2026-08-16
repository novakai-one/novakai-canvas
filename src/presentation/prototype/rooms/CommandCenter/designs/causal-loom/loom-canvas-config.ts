import { type EdgeTypes, type NodeTypes } from '@xyflow/react';
import type { WorldViewport } from '../../../../components/canvas/world-camera';
import type { LoomZoomTier } from './causal-loom-model';
import { LoomKnotNode, type LoomKnotFlowNode } from './LoomKnotNode';
import { LoomThreadEdge } from './LoomThreadEdge';
import { MissionSpindleNode, type MissionSpindleFlowNode } from './MissionSpindleNode';

export type LoomNode = MissionSpindleFlowNode | LoomKnotFlowNode;

export const LOOM_VIEWPORT_KEY = 'command-center:causal-loom';
export const initialLoomViewport: WorldViewport = { x: 430, y: 360, zoom: 0.72 };

export const loomNodeTypes = {
  'mission-spindle': MissionSpindleNode,
  'loom-knot': LoomKnotNode,
} satisfies NodeTypes;

export const loomEdgeTypes = { 'loom-thread': LoomThreadEdge } satisfies EdgeTypes;

export function setsIntersect(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const id of left) if (right.has(id)) return true;
  return false;
}

export function resolveLoomTier(current: LoomZoomTier, zoom: number): LoomZoomTier {
  if (current === 'overview') return zoom >= 0.54 ? 'working' : 'overview';
  if (current === 'detail') return zoom <= 0.94 ? 'working' : 'detail';
  if (zoom <= 0.46) return 'overview';
  if (zoom >= 1.02) return 'detail';
  return 'working';
}

export function resolveLoomSelectionId(node: LoomNode): string | null {
  if (node.type === 'mission-spindle') return node.data.mission?.id ?? null;
  return node.data.item.subject.id;
}

export function isLoomNodeSelected(node: LoomNode, selectedId: string | null): boolean {
  return selectedId !== null && resolveLoomSelectionId(node) === selectedId;
}
