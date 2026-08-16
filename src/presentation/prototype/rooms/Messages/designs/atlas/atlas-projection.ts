import type { Edge, Node } from '@xyflow/react';
import type { AtlasGeometry, AtlasLandmark, RouteKind } from './atlas-geometry';
import type { AtlasZoomTier } from './atlas-semantic-zoom';

export type AtlasNodeData = Record<string, unknown> & {
  landmark: AtlasLandmark;
  tier: AtlasZoomTier;
  focused: boolean;
  dimmed: boolean;
  traversing: boolean;
  revealed: boolean;
};

export type AtlasEdgeData = Record<string, unknown> & {
  kind: RouteKind;
  focused: boolean;
  dimmed: boolean;
  traversing: boolean;
  order: number;
};

export type AtlasNode = Node<AtlasNodeData, 'atlasLandmark'>;
export type AtlasEdge = Edge<AtlasEdgeData, 'atlasRoute'>;

export type ProjectionState = {
  tier: AtlasZoomTier;
  focusedThreadId: string | null;
  selectedId: string | null;
  traversing: boolean;
  revealCount: number;
  positions: ReadonlyMap<string, { x: number; y: number }>;
};

export function projectAtlas(
  geometry: AtlasGeometry,
  state: ProjectionState,
): { nodes: AtlasNode[]; edges: AtlasEdge[] } {
  const nodes = geometry.landmarks.map((landmark) => {
    const focused = state.focusedThreadId !== null && landmark.threadId === state.focusedThreadId;
    const isEndpoint =
      state.focusedThreadId !== null &&
      geometry.nodeIdsByThread.get(state.focusedThreadId)?.includes(landmark.id) === true;
    const sequence = landmark.sequence ?? 0;
    const revealed = !state.traversing || !focused || sequence === 0 || sequence <= state.revealCount;
    const referencesVisible =
      landmark.variant !== 'reference' ||
      (state.focusedThreadId !== null && focused && state.tier !== 'overview');

    return {
      id: landmark.id,
      type: 'atlasLandmark' as const,
      position: state.positions.get(landmark.id) ?? landmark.position,
      data: {
        landmark,
        tier: state.tier,
        focused: focused || isEndpoint,
        dimmed: state.focusedThreadId !== null && !focused && !isEndpoint,
        traversing: state.traversing,
        revealed,
      },
      style: { width: landmark.width, height: landmark.height },
      selected: state.selectedId === landmark.id,
      draggable: ['mission', 'agent', 'reference'].includes(landmark.variant),
      hidden: !referencesVisible,
      selectable: true,
      focusable: true,
      zIndex: state.selectedId === landmark.id ? 30 : landmark.variant === 'message' ? 14 : 10,
    };
  });

  const edges = geometry.connections.map((connection) => {
    const focused = connection.threadId === state.focusedThreadId;
    return {
      id: connection.id,
      source: connection.source,
      target: connection.target,
      type: 'atlasRoute' as const,
      data: {
        kind: connection.kind,
        focused,
        dimmed: state.focusedThreadId !== null && !focused,
        traversing: state.traversing && focused,
        order: connection.order ?? 0,
      },
      zIndex: focused ? 8 : 3,
      selectable: false,
      focusable: false,
      hidden:
        connection.kind === 'reference' &&
        (state.focusedThreadId === null || !focused || state.tier === 'overview'),
    };
  });

  return { nodes, edges };
}
