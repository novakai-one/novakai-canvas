/**
 * Depth geometry for the corridor. Rank distance from the focused pane decides where
 * glass hangs, how much haze blurs it, and when it leaves the visible window — nothing
 * in here knows what a thread is.
 *
 * Depth is meaning: deeper = older. Panes shallower than focus have been walked past
 * and ghost out behind the camera.
 */
export type PanePlacement = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Glass on a wall hangs angled into the corridor; the focused pane faces you. */
  readonly ry: number;
  readonly opacity: number;
  readonly blur: number;
  readonly hidden: boolean;
};

/** How many panes deeper than focus stay visible before the haze swallows them. */
export const DEEPEST_VISIBLE = 8;
/** How many walked-past panes linger between the camera and the focused pane. */
export const NEAREST_VISIBLE = 4;
/** How far one rack of the affordances steps the camera. */
export const RACK_STEP = 3;

const DEPTH_STEP_PX = 200;
const PASSED_STEP_PX = 250;
const SIDE_BASE_PX = 260;
const SIDE_DRIFT_PX = 12;

export function placePane(rank: number, focusRank: number): PanePlacement {
  const depth = rank - focusRank;
  if (depth === 0) return { x: 0, y: 0, z: 0, ry: 0, opacity: 1, blur: 0, hidden: false };

  // Every pane keeps its wall; the corridor stays a colonnade while focus racks.
  const side = rank % 2 === 0 ? 1 : -1;

  // Walked past: continues down its wall toward the camera, sinking and fading.
  if (depth < 0) {
    const passed = -depth;
    const hidden = passed > NEAREST_VISIBLE;
    return {
      x: side * (SIDE_BASE_PX + passed * 60),
      y: passed * 12,
      z: passed * PASSED_STEP_PX,
      ry: -side * 32,
      opacity: hidden ? 0 : Math.max(0.5 - passed * 0.12, 0),
      blur: hidden ? 0 : 2 + passed * 1.2,
      hidden,
    };
  }

  // Deeper: drifts toward the vanishing point through thickening haze.
  const hidden = depth > DEEPEST_VISIBLE;
  return {
    x: side * (SIDE_BASE_PX + depth * SIDE_DRIFT_PX),
    y: -depth * 4,
    z: -depth * DEPTH_STEP_PX,
    ry: -side * 28,
    opacity: hidden ? 0 : Math.max(1 - depth * 0.08, 0.14),
    blur: hidden ? 0 : Math.min(depth * 0.7, 5),
    hidden,
  };
}

/**
 * The open seat: a dashed empty pane holding the nearest berth, where the next
 * conversation will land. Only present while the camera is near the front.
 */
export function placeSeat(focusRank: number): PanePlacement {
  const hidden = focusRank > 1;
  return {
    x: -190,
    y: 36,
    z: 100,
    ry: 20,
    opacity: hidden ? 0 : focusRank === 0 ? 0.8 : 0.35,
    blur: 0,
    hidden,
  };
}

export function paneTransform(placement: PanePlacement): string {
  const { x, y, z, ry } = placement;
  return `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) rotateY(${ry}deg)`;
}
