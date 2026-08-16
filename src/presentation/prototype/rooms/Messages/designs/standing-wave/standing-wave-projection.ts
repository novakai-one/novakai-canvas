/**
 * Turns the Standing Wave reading into canvas primitives.
 *
 * Two rules make the picture readable. Horizontally, every x comes from the shared clock,
 * so position is a moment and nothing else. Vertically, a lane's height is earned: the
 * open conversation is a hero band, one that owes Chris a reply keeps a middle band, and
 * the rest collapse to a sparkline. A five-to-one size ratio says which conversation
 * matters before a single word is read.
 *
 * The projection emits no edges at all. The clock does the connecting, which is the
 * reason this concept was chosen over the alternatives.
 */
import type { Node } from '@xyflow/react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { WaveClock } from './standing-wave-clock';
import type { StandingWaveModel, WaveTrace } from './standing-wave-model';

/**
 * The open conversation is twelve times the height of a resting one.
 *
 * An earlier five-to-one ratio still read as a list of similar rows. At this ratio the
 * focused conversation is unmistakably the subject and everything else is context you can
 * still see but never mistake for the thing being read.
 */
const LANE_HEIGHT_HERO = 340;
const LANE_HEIGHT_AWAITING = 40;
const LANE_HEIGHT_RESTING = 28;
const LANE_GUTTER = 12;
const LANE_PAD_X = 48;
const BEAD_WIDTH = 248;
const BEAD_HEIGHT = 136;
const BEAD_GAP = 12;
const BEAD_STEM_LENGTH = 14;

/** The two detail levels the canvas switches between as it zooms. */
export type WaveTier = 'far' | 'near';

/** How much room a lane has earned, and therefore how much attention it is claiming. */
type LaneEmphasis = 'hero' | 'awaiting' | 'resting';

/** One conversation's band, in canvas coordinates, shared with the screen-fixed legend. */
export type WaveLane = {
  readonly threadId: string;
  readonly y: number;
  readonly height: number;
  readonly emphasis: LaneEmphasis;
  readonly isPeak: boolean;
  readonly trace: WaveTrace;
};

/** A message plotted on the lane baseline at its true moment. */
export type WaveTracePoint = {
  readonly x: number;
  readonly mine: boolean;
  readonly isOwing: boolean;
};

type WaveTraceData = Record<string, unknown> & {
  readonly lane: WaveLane;
  readonly tier: WaveTier;
  readonly width: number;
  readonly points: readonly WaveTracePoint[];
};

type WaveBeadData = Record<string, unknown> & {
  readonly record: ObjectRecord;
  readonly mine: boolean;
  readonly time: string;
  readonly body: string;
  readonly references: readonly ObjectRecord[];
  readonly isOwing: boolean;
  /** Distance from the bead's left edge back to its true position on the clock. */
  readonly stemOffsetX: number;
};

/** One conversation's band on the canvas. */
export type WaveTraceNodeType = Node<WaveTraceData, 'waveTrace'>;

/** One message of the open conversation, at its true clock position. */
export type WaveBeadNodeType = Node<WaveBeadData, 'waveBead'>;

/** Every node kind Standing Wave renders. */
export type WaveNodeType = WaveTraceNodeType | WaveBeadNodeType;

/** The complete canvas picture for one active conversation at one zoom tier. */
type WaveProjection = {
  readonly nodes: readonly WaveNodeType[];
  readonly lanes: readonly WaveLane[];
  readonly contentHeight: number;
  readonly focusNodeId: string | null;
};

function emphasisFor(trace: WaveTrace, activeThreadId: string): LaneEmphasis {
  if (trace.record.id === activeThreadId) return 'hero';
  return trace.awaitingReply ? 'awaiting' : 'resting';
}

function heightFor(emphasis: LaneEmphasis): number {
  if (emphasis === 'hero') return LANE_HEIGHT_HERO;
  return emphasis === 'awaiting' ? LANE_HEIGHT_AWAITING : LANE_HEIGHT_RESTING;
}

/** Stacks lanes newest-first, each one taking only the height its state has earned. */
function layOutLanes(model: StandingWaveModel, activeThreadId: string): WaveLane[] {
  let y = 0;
  return model.traces.map((trace) => {
    const emphasis = emphasisFor(trace, activeThreadId);
    const height = heightFor(emphasis);
    const lane: WaveLane = {
      threadId: trace.record.id,
      y,
      height,
      emphasis,
      isPeak: trace.record.id === model.peakThreadId,
      trace,
    };
    y += height + LANE_GUTTER;
    return lane;
  });
}

function pointsFor(lane: WaveLane, clock: WaveClock, laneLeftX: number): WaveTracePoint[] {
  return lane.trace.messages.map((message) => ({
    x: clock.xForTime(message.time) - laneLeftX,
    mine: message.mine,
    isOwing: message.record.id === lane.trace.owing?.sourceMessageId,
  }));
}

function traceNodeFor(
  lane: WaveLane,
  clock: WaveClock,
  tier: WaveTier,
): WaveTraceNodeType {
  const laneLeftX = clock.startX - LANE_PAD_X;
  const width = clock.nowX - clock.startX + LANE_PAD_X * 2;
  return {
    id: `wave-trace:${lane.threadId}`,
    type: 'waveTrace',
    position: { x: laneLeftX, y: lane.y },
    data: { lane, tier, width, points: pointsFor(lane, clock, laneLeftX) },
    style: { width, height: lane.height },
    draggable: false,
    selectable: true,
    zIndex: lane.emphasis === 'hero' ? 4 : 2,
  };
}

/**
 * Keeps beads in their row from overlapping without lying about when they happened.
 *
 * A nudged bead still draws a stem back to its true position on the clock, so the moment
 * stays honest even when the card had to move to stay readable.
 */
function placeInRow(trueX: number, lastRightEdge: number): number {
  const preferredLeft = trueX - BEAD_WIDTH / 2;
  return Math.max(preferredLeft, lastRightEdge + BEAD_GAP);
}

/**
 * Chris's messages sit above the lane's time axis, the agent's below it.
 *
 * Possession becomes a side of the line, so who is holding the conversation is legible
 * without reading a name.
 */
function beadTopFor(lane: WaveLane, mine: boolean): number {
  const axisY = lane.y + lane.height / 2;
  return mine
    ? axisY - BEAD_STEM_LENGTH - BEAD_HEIGHT
    : axisY + BEAD_STEM_LENGTH;
}

function beadNodesFor(lane: WaveLane, clock: WaveClock): WaveBeadNodeType[] {
  const rowRightEdge = { mine: Number.NEGATIVE_INFINITY, theirs: Number.NEGATIVE_INFINITY };

  return lane.trace.messages.map((message) => {
    const trueX = clock.xForTime(message.time);
    const row = message.mine ? 'mine' : 'theirs';
    const left = placeInRow(trueX, rowRightEdge[row]);
    rowRightEdge[row] = left + BEAD_WIDTH;

    return {
      id: message.record.id,
      type: 'waveBead' as const,
      position: { x: left, y: beadTopFor(lane, message.mine) },
      data: {
        record: message.record,
        mine: message.mine,
        time: message.time,
        body: message.body,
        references: message.references,
        isOwing: message.record.id === lane.trace.owing?.sourceMessageId,
        stemOffsetX: trueX - left,
      },
      style: { width: BEAD_WIDTH, height: BEAD_HEIGHT },
      draggable: false,
      selectable: true,
      zIndex: 8,
    };
  });
}

/** Projects every lane, plus the open conversation's messages when zoomed in to read. */
export function projectStandingWave(
  model: StandingWaveModel,
  clock: WaveClock,
  activeThreadId: string,
  tier: WaveTier,
): WaveProjection {
  const lanes = layOutLanes(model, activeThreadId);
  const heroLane = lanes.find((lane) => lane.emphasis === 'hero') ?? null;
  const beads = heroLane && tier === 'near' ? beadNodesFor(heroLane, clock) : [];
  const lastLane = lanes.at(-1);

  return {
    nodes: [...lanes.map((lane) => traceNodeFor(lane, clock, tier)), ...beads],
    lanes,
    contentHeight: lastLane ? lastLane.y + lastLane.height : 0,
    focusNodeId: beads.at(-1)?.id ?? (heroLane ? `wave-trace:${heroLane.threadId}` : null),
  };
}
