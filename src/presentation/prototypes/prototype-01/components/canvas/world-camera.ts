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

/** A position inside the visible canvas, expressed as ratios from its top-left corner. */
export type WorldViewportAnchor = {
  horizontalRatio: number;
  verticalRatio: number;
};

type FrameNodesCameraCommand = {
  type: 'frame-nodes';
  key: string;
  nodeIds: readonly string[];
  padding?: WorldCameraPadding;
  minZoom?: number;
  maxZoom?: number;
  duration?: number;
};

type FocusNodeCameraCommand = {
  type: 'focus-node';
  key: string;
  nodeId: string;
  padding?: WorldCameraPadding;
  zoom?: number;
  duration?: number;
};

/** Places a node at a deliberate point in the viewport instead of always centring it. */
type FocusNodeAtAnchorCameraCommand = {
  type: 'focus-node-at-anchor';
  key: string;
  nodeId: string;
  anchor: WorldViewportAnchor;
  zoom?: number;
  duration?: number;
};

export type WorldCameraCommand =
  | FrameNodesCameraCommand
  | FocusNodeCameraCommand
  | FocusNodeAtAnchorCameraCommand
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
    }
  | {
      type: 'set-zoom';
      key: string;
      zoom: number;
      duration?: number;
    };

/** Typed result returned after the canvas interprets a camera command. */
export type WorldCameraOutcome =
  | 'applied'
  | 'node-missing'
  | 'viewport-missing'
  | 'no-nodes'
  | 'not-ready';
