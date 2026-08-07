import type { Node, NodeChange } from '@xyflow/react';

/**
 * Gesture frames that have not happened yet, as far as the record is concerned.
 *
 * React Flow is controlled: it only draws a node where the `nodes` prop says, so a drag or
 * resize is invisible until the host feeds each frame back. The record must not hear those
 * frames — one gesture is one undoable act (d5f5980) — so they live here instead: rendered
 * immediately, committed once when the gesture ends, discarded if it is cancelled.
 */
export interface InFlightFrame {
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export type InFlight = Readonly<Record<string, InFlightFrame>>;

/** Folds one React Flow change into the overlay. Anything that is not a gesture frame is ignored. */
export function applyFrame(inFlight: InFlight, change: NodeChange): InFlight {
  if (change.type === 'position' && change.position) {
    return { ...inFlight, [change.id]: { ...inFlight[change.id], position: change.position } };
  }
  // Only user-driven resizes carry `resizing` — React Flow's initial DOM measurements must
  // not become frames, or every stored size would be rewritten by what the DOM happens to say.
  if (change.type === 'dimensions' && change.dimensions && change.resizing) {
    return { ...inFlight, [change.id]: { ...inFlight[change.id], size: change.dimensions } };
  }
  if (change.type === 'remove') return clearInFlight(inFlight, change.id);
  return inFlight;
}

/** Draws each node where the gesture has it, leaving everything else exactly as projected. */
export function mergeInFlight<T extends Node>(nodes: T[], inFlight: InFlight): T[] {
  if (Object.keys(inFlight).length === 0) return nodes;
  return nodes.map((node) => {
    const frame = inFlight[node.id];
    if (!frame) return node;
    return {
      ...node,
      position: frame.position ?? node.position,
      width: frame.size?.width ?? node.width,
      height: frame.size?.height ?? node.height,
    };
  });
}

/** Drops one node's frames — the gesture ended, one way or another. */
export function clearInFlight(inFlight: InFlight, id: string): InFlight {
  if (!(id in inFlight)) return inFlight;
  const next = { ...inFlight };
  delete next[id];
  return next;
}
