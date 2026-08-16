/**
 * One conversation drawn as a seismic trace.
 *
 * The lane's time axis runs through its vertical centre. A message Chris sent ticks
 * upward, a message the agent sent ticks downward, and silence is the flat run between
 * them. The single conversation that owes Chris something carries the one gold tick in
 * the Room; every other lane stays in wire grey.
 */
import type { NodeProps } from '@xyflow/react';
import type { WaveTraceNodeType, WaveTracePoint } from './standing-wave-projection';

const TICK_RATIO_RESTING = 0.3;
const OWING_TICK_RATIO_RESTING = 0.46;
const TICK_HEIGHT_HERO = 12;
const OWING_TICK_HEIGHT_HERO = 20;

/**
 * On the hero lane the cards carry the reading, so its ticks stay small and absolute:
 * a fine instrument line under the message rows rather than a second competing signal.
 * Context lanes have nothing but ticks, so theirs scale with the lane.
 */
function tickHeight(point: WaveTracePoint, laneHeight: number, isHero: boolean): number {
  if (isHero) return point.isOwing ? OWING_TICK_HEIGHT_HERO : TICK_HEIGHT_HERO;
  return laneHeight * (point.isOwing ? OWING_TICK_RATIO_RESTING : TICK_RATIO_RESTING);
}

/** Draws the whole conversation's rhythm in one pass, ticks reading up for mine. */
function TraceRhythm({
  points,
  width,
  height,
  isHero,
}: {
  points: readonly WaveTracePoint[];
  width: number;
  height: number;
  isHero: boolean;
}) {
  const axisY = height / 2;
  return (
    <svg className="wave-trace__rhythm" width={width} height={height} aria-hidden="true">
      <line className="wave-trace__axis" x1={0} y1={axisY} x2={width} y2={axisY} />
      {points.map((point) => {
        const reach = tickHeight(point, height, isHero);
        return (
          <line
            key={`${point.x}:${point.mine}`}
            className="wave-trace__tick"
            data-mine={point.mine}
            data-owing={point.isOwing}
            x1={point.x}
            y1={axisY}
            x2={point.x}
            y2={point.mine ? axisY - reach : axisY + reach}
          />
        );
      })}
    </svg>
  );
}

/** A single conversation band, sized by the attention it has earned. */
export function WaveTraceNode({ data, selected }: NodeProps<WaveTraceNodeType>) {
  const { lane, width, points, tier } = data;
  return (
    <div
      className="wave-trace"
      data-emphasis={lane.emphasis}
      data-peak={lane.isPeak}
      data-tier={tier}
      data-selected={selected}
      style={{ width, height: lane.height }}
    >
      <TraceRhythm
        points={points}
        width={width}
        height={lane.height}
        isHero={lane.emphasis === 'hero'}
      />
      {lane.trace.messages.length === 0 && (
        <span className="wave-trace__ghost" aria-hidden="true" />
      )}
    </div>
  );
}
