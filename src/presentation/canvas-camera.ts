/**
 * Explicit travel over the open diagram.
 *
 * Selection never moves the camera; only a deliberate act of travel does. This is the contract
 * for that deliberate act, so chrome outside the canvas — a rail row, a contents-row jump icon —
 * can ask the canvas to move without knowing anything about React Flow, viewports, or zoom.
 *
 * Exactly one canvas is open at a time, so the surface publishes its camera here on mount and
 * withdraws it on unmount. A caller that arrives while no canvas is mounted gets a camera that
 * politely does nothing, which is the honest answer: there is nowhere to travel to.
 */
export interface CanvasCamera {
  /** Eases the open diagram until the named node is centred, at the zoom already in use. */
  centerOnNode: (nodeId: string) => void;
  /** Frames the whole diagram. */
  fit: () => void;
  /**
   * The point in the diagram the user is currently looking at.
   *
   * Read, not moved — this is how chrome outside the canvas places something "here" without
   * knowing what "here" means. The studio creates objects with it, so a new object lands in
   * view rather than at a fixed coordinate somewhere else in the diagram.
   */
  focusPoint: () => { x: number; y: number };
}

const NOWHERE_TO_GO: CanvasCamera = {
  centerOnNode: () => {},
  fit: () => {},
  focusPoint: () => ({ x: 0, y: 0 }),
};

let published: CanvasCamera | null = null;

/** The open canvas offers its camera; passing `null` withdraws it as the canvas unmounts. */
export function publishCanvasCamera(camera: CanvasCamera | null): void {
  published = camera;
}

/** The camera of the open canvas, or a camera that does nothing when none is open. */
export function canvasCamera(): CanvasCamera {
  return published ?? NOWHERE_TO_GO;
}
