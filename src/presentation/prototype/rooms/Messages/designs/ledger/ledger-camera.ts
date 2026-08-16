/**
 * The document camera's policy: when it may move and how far in it may read.
 *
 * Two scales with hysteresis — `reading` is the desk, `spine` is the shelf. The
 * camera never moves on its own; every request here is minted by an explicit user
 * action (Room entry counts as one: the person walked in).
 */

export type LedgerTier = 'reading' | 'spine';

const SPINE_ENTER = 0.48;
const SPINE_EXIT = 0.58;

export function resolveLedgerTier(zoom: number, previous: LedgerTier): LedgerTier {
  if (previous === 'spine') return zoom >= SPINE_EXIT ? 'reading' : 'spine';
  return zoom <= SPINE_ENTER ? 'spine' : 'reading';
}

export type LedgerCameraRequest =
  | {
      /** Land at reading scale on a band's column-head — never shrink-to-fit. */
      readonly key: string;
      readonly kind: 'focus';
      readonly bandId: string;
      readonly duration?: number;
    }
  | {
      readonly key: string;
      readonly kind: 'viewport';
      readonly viewport: { x: number; y: number; zoom: number };
      readonly duration?: number;
    };

/** Reading scale for a given canvas width: full-bleed ink, always legible. */
export function readingZoom(canvasWidth: number): number {
  return Math.min(1.12, Math.max(0.88, canvasWidth / 1440));
}

export function frameBand(bandId: string, key: string, duration = 720): LedgerCameraRequest {
  return { key, kind: 'focus', bandId, duration };
}

export function restoreViewport(
  viewport: { x: number; y: number; zoom: number },
  key: string,
): LedgerCameraRequest {
  return { key, kind: 'viewport', viewport, duration: 560 };
}
