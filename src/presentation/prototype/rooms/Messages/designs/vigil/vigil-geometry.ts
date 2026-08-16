/**
 * Vigil's spatial grammar: distance from you means time since it last spoke.
 *
 * One axis carries the meaning three ways — radius, scale and depth tier all come
 * from the same silence reading, so a lantern can never look recent while sitting far
 * out in the fog. Pure maths only; nothing here knows about React or the object graph.
 */

/**
 * How readable a lantern is at its distance.
 *
 * Near is sharp and far dissolves into fog. A `mark` carries no text at all: past a
 * certain distance a name could only ever be half-read, so the outermost ring shows
 * presence and nothing else, and the legend carries its count instead.
 */
export type VigilDepth = 'near' | 'mid' | 'far' | 'mark';

/** One ring of the floor: everything that fell silent within the same stretch of time. */
type VigilBand = {
  readonly id: string;
  readonly label: string;
  readonly maxSilentMinutes: number;
  readonly radiusX: number;
  readonly scale: number;
  readonly depth: VigilDepth;
};

/**
 * The four bands.
 *
 * The boundaries are calibrated against the conversations actually on the floor rather
 * than a tidy clock — they cluster at roughly 0, 10-16 hours, 40 hours and 24 days of
 * silence — so every ring stays populated and the axis stays legible.
 *
 * The radii are not chosen for looks. Two conversations on adjacent rings can drift to
 * the same angle, and when they do they must still not touch, so each gap clears both
 * neighbours side by side AND, because the floor is flattened, clears them stacked at
 * the top and bottom of the ellipse where the same gap is worth only half as much.
 */
export const VIGIL_BANDS: readonly VigilBand[] = [
  { id: 'now', label: 'Just spoke', maxSilentMinutes: 60, radiusX: 290, scale: 1, depth: 'near' },
  { id: 'today', label: 'Today', maxSilentMinutes: 1_080, radiusX: 504, scale: 0.66, depth: 'mid' },
  { id: 'week', label: 'This week', maxSilentMinutes: 5_760, radiusX: 683, scale: 0.5, depth: 'far' },
  { id: 'quiet', label: 'Gone quiet', maxSilentMinutes: Number.POSITIVE_INFINITY, radiusX: 788, scale: 0.24, depth: 'mark' },
];

/** One ring's share of the floor, as the legend reads it out. */
export type BandTally = {
  readonly label: string;
  readonly depth: VigilDepth;
  readonly count: number;
};

/**
 * Counts what sits on each ring.
 *
 * The outermost ring renders as marks with no text, so this is where its
 * conversations are actually accounted for — nothing is silently dropped.
 */
export function countByBand(silentMinutesEach: readonly number[]): readonly BandTally[] {
  return VIGIL_BANDS.map((band) => ({
    label: band.label,
    depth: band.depth,
    count: silentMinutesEach.filter((minutes) => bandForSilence(minutes) === band).length,
  }));
}

/** The floor is read at an angle, so every ring is an ellipse rather than a circle. */
export const RING_FLATTENING = 0.56;

/** Width of a lantern in the innermost band. Every other band scales down from here. */
const NEAR_LANTERN_WIDTH = 210;

/** Clearance between a lantern and the newest moment on its ray. */
const MOMENT_LEAD = 230;

/** Clear air kept between two neighbouring moments, across and down. */
const MOMENT_GUTTER_X = 44;
const MOMENT_GUTTER_Y = 34;

/** How far a gap in the conversation pushes the older moment further into the dark. */
const VOID_STEP = 48;

/** A point on the floor, in canvas units, with the origin at you. */
export type FloorPoint = { readonly x: number; readonly y: number };

/** Where one conversation sits on the floor, and how much of it can be read there. */
export type LanternSeat = {
  readonly point: FloorPoint;
  readonly bandLabel: string;
  readonly bandRadiusX: number;
  readonly depth: VigilDepth;
  readonly width: number;
};

function bandForSilence(silentMinutes: number): VigilBand {
  return VIGIL_BANDS.find((band) => silentMinutes <= band.maxSilentMinutes) ?? VIGIL_BANDS[3]!;
}

/**
 * Seats one lantern on its ring.
 *
 * Bands are phase-shifted against each other so lanterns never line up into spokes,
 * which would read as a structure the data does not have.
 */
function seatOnBand(band: VigilBand, indexInBand: number, countInBand: number): FloorPoint {
  const bandPhase = VIGIL_BANDS.indexOf(band) * 0.72;
  const angle = bandPhase + (indexInBand * 2 * Math.PI) / Math.max(1, countInBand);
  return {
    x: band.radiusX * Math.cos(angle),
    y: band.radiusX * RING_FLATTENING * Math.sin(angle),
  };
}

/**
 * Seats every conversation on the floor from its silence alone.
 *
 * Choosing the ring, spacing the lanterns already on it and sizing each one are all
 * consequences of the same reading, so they are decided here together rather than
 * step by step by the caller. Seats come back in the order the silences arrived.
 */
export function seatLanterns(silentMinutesEach: readonly number[]): readonly LanternSeat[] {
  const orderWithinBand = new Map<VigilBand, number[]>();

  for (const [index, silentMinutes] of silentMinutesEach.entries()) {
    const band = bandForSilence(silentMinutes);
    orderWithinBand.set(band, [...(orderWithinBand.get(band) ?? []), index]);
  }

  const seats: LanternSeat[] = [];

  for (const [band, indexes] of orderWithinBand) {
    indexes.forEach((seatedIndex, positionInBand) => {
      seats[seatedIndex] = {
        point: seatOnBand(band, positionInBand, indexes.length),
        bandLabel: band.label,
        bandRadiusX: band.radiusX,
        depth: band.depth,
        width: Math.round(NEAR_LANTERN_WIDTH * band.scale),
      };
    });
  }

  return seats;
}

/** The outward direction of a lantern's ray, pointing away from you. */
function rayDirection(lanternPoint: FloorPoint): FloorPoint {
  const length = Math.hypot(lanternPoint.x, lanternPoint.y);
  if (length === 0) return { x: 1, y: 0 };
  return { x: lanternPoint.x / length, y: lanternPoint.y / length };
}

/** One moment's place in the queue: how long it waited, and how big it will draw. */
type MomentExtent = {
  readonly minutesBefore: number;
  readonly width: number;
  readonly height: number;
};

/**
 * The smallest step along the ray that clears both cards.
 *
 * A ray running sideways has to clear a card's width; one running up or down only
 * has to clear its height, and vertical travel is flattened with the floor. Clearing
 * either axis is enough to separate them, so the smaller of the two requirements wins.
 */
function stepClearing(direction: FloorPoint, near: MomentExtent, far: MomentExtent): number {
  const acrossNeeded = (near.width + far.width) / 2 + MOMENT_GUTTER_X;
  const downNeeded = (near.height + far.height) / 2 + MOMENT_GUTTER_Y;

  const acrossStep = Math.abs(direction.x) > 0.001
    ? acrossNeeded / Math.abs(direction.x)
    : Number.POSITIVE_INFINITY;
  const downStep = Math.abs(direction.y) > 0.001
    ? downNeeded / (Math.abs(direction.y) * RING_FLATTENING)
    : Number.POSITIVE_INFINITY;

  return Math.min(acrossStep, downStep);
}

/**
 * Seats every moment of one conversation along its lantern's ray, newest first.
 *
 * Each moment steps far enough to clear the one before it whichever way the ray
 * happens to run, then earns a share of the silence that preceded it. An exchange
 * minutes apart stays tight; an overnight gap opens a visible void. That void is how
 * you see where a conversation stopped.
 */
export function momentSeats(
  lanternPoint: FloorPoint,
  extents: readonly MomentExtent[],
): readonly FloorPoint[] {
  const direction = rayDirection(lanternPoint);
  let distance = MOMENT_LEAD;

  return extents.map((extent, index) => {
    const previous = extents[index - 1];
    if (previous) {
      distance += stepClearing(direction, previous, extent)
        + VOID_STEP * Math.log10(1 + Math.max(0, extent.minutesBefore));
    }
    return {
      x: lanternPoint.x + direction.x * distance,
      y: lanternPoint.y + direction.y * distance * RING_FLATTENING,
    };
  });
}
