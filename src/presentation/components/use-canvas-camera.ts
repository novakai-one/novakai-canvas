import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { Viewport } from '@xyflow/react';
import type { CanvasPreferences } from '../../domain/model';
import type { WorldPoint } from '../canvas-actions';
import { canvasCamera, publishCanvasCamera } from '../canvas-camera';
import { semanticZoomTier, type SemanticZoomTier } from '../semantic-zoom';

/** Only the parts of React Flow's instance the camera actually uses. */
export interface FlowInstance {
  setViewport: (viewport: Viewport) => unknown;
  getViewport: () => Viewport;
  fitView: (options?: {
    nodes?: { id: string }[]; duration?: number; padding?: number;
    minZoom?: number; maxZoom?: number;
  }) => unknown;
  screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number };
}

/** Calm is slow: travel is a structural move, and the eye must be able to follow it. */
const TRAVEL_MS = 700;

/**
 * Everything about where the canvas is looking.
 *
 * Camera memory is session-scoped and stored per diagram. Live zoom is published straight to
 * the surface because React state would rebuild the whole graph for every trackpad frame.
 */
export function useCanvasCamera(activeDiagramId: string): {
  surface: RefObject<HTMLElement | null>;
  fitOnOpen: boolean;
  remember: (viewport: Viewport) => void;
  attach: (instance: FlowInstance) => void;
  publishZoom: (zoom: number) => void;
  focusPoint: () => WorldPoint;
  toWorld: (point: { x: number; y: number }) => WorldPoint;
} {
  const flow = useRef<FlowInstance | null>(null);
  const surface = useRef<HTMLElement | null>(null);
  const cameras = useRef(new Map<string, Viewport>());
  const tier = useRef<{ diagramId: string; value: SemanticZoomTier } | null>(null);
  const remembered = cameras.current.get(activeDiagramId);

  useEffect(() => {
    publishCanvasCamera({
      centerOnNode: (nodeId) => {
        const instance = flow.current;
        if (!instance) return;
        const { zoom } = instance.getViewport();
        instance.fitView({
          nodes: [{ id: nodeId }], duration: TRAVEL_MS, minZoom: zoom, maxZoom: zoom,
        });
      },
      fit: () => flow.current?.fitView({ duration: TRAVEL_MS, padding: 0.12, maxZoom: 1 }),
      focusPoint: () => {
        const instance = flow.current;
        const box = surface.current?.getBoundingClientRect();
        if (!instance || !box) return { x: 0, y: 0 };
        return instance.screenToFlowPosition({
          x: box.x + box.width / 2, y: box.y + box.height / 2,
        });
      },
    });
    return () => publishCanvasCamera(null);
  }, []);

  const publishZoom = useCallback((zoom: number): void => {
    const element = surface.current;
    if (!element) return;
    const previous = tier.current?.diagramId === activeDiagramId ? tier.current.value : undefined;
    const value = semanticZoomTier(zoom, previous);
    tier.current = { diagramId: activeDiagramId, value };
    element.style.setProperty('--nvk-zoom', String(zoom));
    element.dataset.zoomTier = value;
  }, [activeDiagramId]);

  return {
    surface,
    fitOnOpen: remembered === undefined,
    remember: (viewport: Viewport) => { cameras.current.set(activeDiagramId, viewport); },
    publishZoom,
    attach: (instance: FlowInstance) => {
      flow.current = instance;
      const saved = cameras.current.get(activeDiagramId);
      if (saved) { instance.setViewport(saved); return; }
      window.setTimeout(() => {
        if (!cameras.current.has(activeDiagramId)) {
          instance.fitView({ padding: 0.1, maxZoom: 1, minZoom: 0.05 });
        }
      }, 90);
    },
    focusPoint: () => {
      const instance = flow.current;
      const box = surface.current?.getBoundingClientRect();
      if (!instance || !box) return { x: 0, y: 0 };
      return instance.screenToFlowPosition({
        x: box.x + box.width / 2, y: box.y + box.height / 2,
      });
    },
    toWorld: (point) => flow.current?.screenToFlowPosition(point) ?? { x: 0, y: 0 },
  };
}

/** Panel movement may reframe only when the existing explicit preference permits it. */
export function useRefitWhenPanelsMove(panel: CanvasPreferences['panel']): void {
  const { railCollapsed, railWidth, reframeOnPanelMove, studioCollapsed, width } = panel;
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) { settled.current = true; return; }
    if (!reframeOnPanelMove) return;
    const timer = window.setTimeout(() => canvasCamera().fit(), TRAVEL_MS + 60);
    return () => window.clearTimeout(timer);
  }, [railCollapsed, railWidth, reframeOnPanelMove, studioCollapsed, width]);
}
