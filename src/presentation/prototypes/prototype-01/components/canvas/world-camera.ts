/** Framework-neutral controls exposed to disposable spatial room designs. */
export type WorldViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type WorldCameraPadding =
  | number
  | {
      top: number | string;
      right: number | string;
      bottom: number | string;
      left: number | string;
    };

export type FrameNodesCameraCommand = {
  type: 'frame-nodes';
  key: string;
  nodeIds: readonly string[];
  padding?: WorldCameraPadding;
  minZoom?: number;
  maxZoom?: number;
  duration?: number;
};

export type FocusNodeCameraCommand = {
  type: 'focus-node';
  key: string;
  nodeId: string;
  padding?: WorldCameraPadding;
  zoom?: number;
  duration?: number;
};

export type WorldCameraCommand =
  | FrameNodesCameraCommand
  | FocusNodeCameraCommand
  | {
      type: 'set-viewport';
      key: string;
      viewport: WorldViewport;
      duration?: number;
    }
  | {
      type: 'restore-viewport';
      key: string;
      viewportKey?: string;
      duration?: number;
    };

/** Interaction policy a design may customise without importing React Flow props. */
export type WorldCanvasInteraction = {
  nodesDraggable?: boolean;
  panOnDrag?: boolean | number[];
  panOnScroll?: boolean;
  zoomOnScroll?: boolean;
  zoomOnPinch?: boolean;
  zoomOnDoubleClick?: boolean;
  minZoom?: number;
  maxZoom?: number;
  translateExtent?: [[number, number], [number, number]];
  nodeExtent?: [[number, number], [number, number]];
};

/** Maps optical zoom to a design-owned semantic tier. */
export type ZoomTierResolver<TTier> = (zoom: number, previousTier: TTier) => TTier;
