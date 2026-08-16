/**
 * The one shared clock every conversation is measured against.
 *
 * Standing Wave's whole claim is that a horizontal position means a moment in time, the
 * same moment in every lane. That claim only holds if exactly one module converts a
 * timestamp into an x coordinate, so this is it: nothing else in the design is allowed to
 * derive a position from a date.
 *
 * Real agent traffic is bursty — four messages in ten minutes, then eight hours of
 * silence. Drawn linearly, the silence would be the entire canvas. So idle gaps compress
 * to a fixed width and the compressed spans are published, because the ground draws them
 * as visibly quieter bands. Gaps compress; order never lies.
 */

/**
 * Active minutes are drawn generously.
 *
 * A tighter scale packed a burst of four messages into a few hundred pixels, which forced
 * their cards to overlap and shunt sideways. Stretching the minute gives each moment room
 * to be read where it actually happened.
 */
const PIXELS_PER_MINUTE = 18;
const QUIET_GAP_MINUTES = 30;
const QUIET_SPAN_WIDTH = 240;
const CLOCK_START_X = 0;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_MINUTE = 60_000;

/** A compressed stretch of silence, published so the ground can declare the squeeze. */
type QuietSpan = {
  readonly startX: number;
  readonly endX: number;
  readonly minutes: number;
};

/** One calendar day of traffic, used for the ground's oversized day watermark. */
type DayBand = {
  readonly label: string;
  readonly startX: number;
  readonly endX: number;
};

/** An hour marker that falls inside linear time rather than inside a compressed gap. */
type HourTick = {
  readonly x: number;
  readonly label: string;
};

/** The shared time axis: the single authority for horizontal position. */
export type WaveClock = {
  readonly startX: number;
  readonly nowX: number;
  readonly quietSpans: readonly QuietSpan[];
  readonly dayBands: readonly DayBand[];
  readonly hourTicks: readonly HourTick[];
  xForTime(isoTime: string): number;
};

type Anchor = { readonly time: number; readonly x: number };

function sortedDistinctTimes(isoTimes: readonly string[]): number[] {
  const parsed = isoTimes
    .map((isoTime) => Date.parse(isoTime))
    .filter((time) => Number.isFinite(time));
  return [...new Set(parsed)].sort((left, right) => left - right);
}

function minutesBetween(earlier: number, later: number): number {
  return (later - earlier) / MILLISECONDS_PER_MINUTE;
}

/** Lays every known moment on the axis, compressing anything quieter than half an hour. */
function layOutAnchors(times: readonly number[]): { anchors: Anchor[]; quietSpans: QuietSpan[] } {
  const anchors: Anchor[] = [];
  const quietSpans: QuietSpan[] = [];
  let x = CLOCK_START_X;

  times.forEach((time, index) => {
    const previous = times[index - 1];
    if (previous !== undefined) {
      const gapMinutes = minutesBetween(previous, time);
      if (gapMinutes > QUIET_GAP_MINUTES) {
        quietSpans.push({ startX: x, endX: x + QUIET_SPAN_WIDTH, minutes: gapMinutes });
        x += QUIET_SPAN_WIDTH;
      } else {
        x += gapMinutes * PIXELS_PER_MINUTE;
      }
    }
    anchors.push({ time, x });
  });

  return { anchors, quietSpans };
}

/** Interpolates between the two anchors that bracket a moment; clamps outside the domain. */
function positionForTime(anchors: readonly Anchor[], time: number): number {
  const first = anchors[0];
  const last = anchors.at(-1);
  if (!first || !last) return CLOCK_START_X;
  if (time <= first.time) return first.x;
  if (time >= last.time) return last.x;

  for (let index = 1; index < anchors.length; index += 1) {
    const before = anchors[index - 1];
    const after = anchors[index];
    if (before && after && time <= after.time) {
      const span = after.time - before.time;
      const progress = span === 0 ? 0 : (time - before.time) / span;
      return before.x + (after.x - before.x) * progress;
    }
  }
  return last.x;
}

function utcDayLabel(time: number): string {
  const [weekday, rest] = new Date(time).toUTCString().split(', ');
  const [dayOfMonth, month] = (rest ?? '').split(' ');
  return `${weekday ?? ''} ${dayOfMonth ?? ''} ${month ?? ''}`.trim().toUpperCase();
}

function utcHourLabel(time: number): string {
  return `${String(new Date(time).getUTCHours()).padStart(2, '0')}:00`;
}

function buildDayBands(anchors: readonly Anchor[]): DayBand[] {
  const bands: DayBand[] = [];
  for (const anchor of anchors) {
    const label = utcDayLabel(anchor.time);
    const openBand = bands.at(-1);
    if (openBand?.label === label) {
      bands[bands.length - 1] = { ...openBand, endX: anchor.x };
    } else {
      bands.push({ label, startX: anchor.x, endX: anchor.x });
    }
  }
  return bands;
}

function fallsInsideQuietSpan(quietSpans: readonly QuietSpan[], x: number): boolean {
  return quietSpans.some((span) => x > span.startX && x < span.endX);
}

/** One tick per hour, skipping any hour swallowed by a compressed gap. */
function buildHourTicks(anchors: readonly Anchor[], quietSpans: readonly QuietSpan[]): HourTick[] {
  const first = anchors[0];
  const last = anchors.at(-1);
  if (!first || !last) return [];

  const ticks: HourTick[] = [];
  const hourStep = MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;
  const firstHour = Math.ceil(first.time / hourStep) * hourStep;

  for (let time = firstHour; time <= last.time; time += hourStep) {
    const x = positionForTime(anchors, time);
    if (!fallsInsideQuietSpan(quietSpans, x)) {
      ticks.push({ x, label: utcHourLabel(time) });
    }
  }
  return ticks;
}

/** Builds the shared axis from every message time in the Room. */
export function buildWaveClock(isoTimes: readonly string[]): WaveClock {
  const times = sortedDistinctTimes(isoTimes);
  const { anchors, quietSpans } = layOutAnchors(times);

  return {
    startX: CLOCK_START_X,
    nowX: anchors.at(-1)?.x ?? CLOCK_START_X,
    quietSpans,
    dayBands: buildDayBands(anchors),
    hourTicks: buildHourTicks(anchors, quietSpans),
    xForTime: (isoTime: string) => {
      const time = Date.parse(isoTime);
      return Number.isFinite(time) ? positionForTime(anchors, time) : CLOCK_START_X;
    },
  };
}
