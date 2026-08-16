/**
 * The physics of the room, as pure numbers.
 *
 * Two rules carry all the meaning: distance along a cable is elapsed time, and the
 * depth of its sag is how long an ask has hung there unanswered. Callers ask for a
 * whole cable's layout and get one back; they never do the bookkeeping themselves.
 * Nothing here knows about React, React Flow or the DOM.
 */
import type { Cable, CableLoad, CableMessage } from './catenary-model';

/** Vertical distance between a lane's anchors and the hour numerals beneath it. */
export const FLOOR_DROP = 250;

/** How many conversations sit either side of the hero before the rest become a tally. */
export const STAGE_CONTEXT_EACH_SIDE = 3;

const CABLE_LEAD_IN = 150;
const CABLE_LEAD_OUT = 190;
const MINIMUM_SPAN = 720;

/** Clearance under the hero cable: its deepest sag, its lowest card, and the hour floor. */
const HERO_CLEARANCE = 310;
/** Context cables sit close together, because their shape is all you read of them. */
const CONTEXT_LANE_GAP = 104;

/** Never closer than one turn card is wide, so beads read as beads and not as a pile. */
const MINIMUM_GAP = 236;
const MAXIMUM_GAP = 560;
const GAP_PER_ROOT_MINUTE = 34;

const RESTING_SAG = 16;
const SAG_PER_ROOT_HOUR = 12;
const MAXIMUM_SAG = 170;

/** One turn's place on its cable: how far along, how far down, and the hour it landed. */
type BeadPlacement = {
  readonly offset: number;
  readonly drop: number;
  readonly hourLabel: string;
};

/** Everything about a cable's shape, resolved in one pass. */
export type CableLayout = {
  readonly span: number;
  readonly sag: number;
  readonly beads: readonly BeadPlacement[];
};

/**
 * How far apart two turns sit.
 *
 * Compressed by a square root so an overnight silence still reads as a long empty
 * run of cable without pushing the next turn off the canvas.
 */
function gapAfterSilence(minutes: number): number {
  const raw = GAP_PER_ROOT_MINUTE * Math.sqrt(Math.max(0, minutes));
  return Math.round(Math.min(MAXIMUM_GAP, Math.max(MINIMUM_GAP, raw)));
}

function beadOffsets(messages: readonly CableMessage[]): number[] {
  let offset = CABLE_LEAD_IN;
  return messages.map((message, index) => {
    if (index > 0) offset += gapAfterSilence(message.minutesAfterPrevious);
    return offset;
  });
}

/**
 * How deep the cable hangs.
 *
 * Also square-root compressed: the first hours of waiting are the ones that show,
 * and a fortnight-old thread cannot drag its cable through the lane below.
 */
function sagFor(load: CableLoad | null): number {
  if (!load) return RESTING_SAG;
  const raw = RESTING_SAG + SAG_PER_ROOT_HOUR * Math.sqrt(load.hoursWaiting);
  return Math.round(Math.min(MAXIMUM_SAG, raw));
}

/**
 * The drop below the anchor line at a point along the cable.
 *
 * The cable is a quadratic curve whose control point sits at twice the sag, which
 * puts its lowest point exactly `sag` below the anchors at the halfway mark.
 */
function curveDrop(sag: number, fraction: number): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  return 4 * sag * clamped * (1 - clamped);
}

/** The hour a turn landed, as the numeral written into the floor beneath it. */
function hourLabel(message: CableMessage): string {
  const sent = new Date(String(message.record.fields.createdAt ?? ''));
  return Number.isNaN(sent.getTime()) ? '' : sent.toISOString().slice(11, 13);
}

/** Resolves one cable's whole shape: its length, its sag, and every bead on it. */
export function layOutCable(cable: Cable): CableLayout {
  const offsets = beadOffsets(cable.messages);
  const span = Math.max(MINIMUM_SPAN, (offsets.at(-1) ?? CABLE_LEAD_IN) + CABLE_LEAD_OUT);
  const sag = sagFor(cable.load);

  return {
    span,
    sag,
    beads: cable.messages.map((message, index) => {
      const offset = offsets[index] ?? CABLE_LEAD_IN;
      return { offset, drop: curveDrop(sag, offset / span), hourLabel: hourLabel(message) };
    }),
  };
}

/**
 * The vertical position of a cable on the stage.
 *
 * The hero always sits at zero, so the camera has a fixed place to land. Context
 * cables hang off it at a constant rhythm rather than being one row in a long list.
 */
export function laneY(slot: number): number {
  if (slot === 0) return 0;
  const steps = Math.abs(slot);
  return Math.sign(slot) * (HERO_CLEARANCE + (steps - 1) * CONTEXT_LANE_GAP);
}

/** How far a cable sits from the hero — the depth cue for scale and dimming. */
export function laneDepth(slot: number): number {
  return Math.min(3, Math.abs(slot));
}

/** Where the peripheral tally sits: below every staged cable, out of the reading path. */
export function tallyY(lowestSlot: number): number {
  return laneY(lowestSlot) + 90;
}

/** The belly depth an inspector readout should draw for a load, in cable units. */
export function loadCurveDrop(load: CableLoad | null): number {
  return curveDrop(sagFor(load), 0.5);
}
