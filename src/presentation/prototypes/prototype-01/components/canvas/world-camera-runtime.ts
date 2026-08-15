import type {
  WorldCameraCommand,
  WorldCameraPadding,
  WorldViewport,
} from './world-camera';

type FrameNodesOptions = {
  padding?: WorldCameraPadding;
  minZoom?: number;
  maxZoom?: number;
  duration?: number;
};

export type WorldCameraRuntime = {
  frameNodes(nodeIds: readonly string[], options: FrameNodesOptions): Promise<boolean>;
  setViewport(viewport: WorldViewport, duration?: number): Promise<boolean>;
  restoreViewport(viewportKey: string, duration?: number): Promise<boolean>;
};

/** Keeps camera command interpretation out of room designs and the React component. */
export function executeWorldCameraCommand(
  command: WorldCameraCommand,
  runtime: WorldCameraRuntime,
): Promise<boolean> {
  switch (command.type) {
    case 'frame-nodes':
      if (command.nodeIds.length === 0) return Promise.resolve(false);
      return runtime.frameNodes(command.nodeIds, command);
    case 'focus-node':
      return runtime.frameNodes([command.nodeId], {
        padding: command.padding ?? 0.28,
        minZoom: command.zoom,
        maxZoom: command.zoom,
        duration: command.duration,
      });
    case 'set-viewport':
      return runtime.setViewport(command.viewport, command.duration);
    case 'restore-viewport':
      return runtime.restoreViewport(command.viewportKey ?? command.key, command.duration);
  }
}
