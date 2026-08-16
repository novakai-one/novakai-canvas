/**
 * The ground the traces are drawn on, in canvas coordinates so it pans and zooms with
 * them.
 *
 * Four layers, each carrying information rather than texture. Light falls off towards the
 * past, so older time is literally darker. A compressed silence is drawn as a quieter band
 * and labelled with the hours it swallowed, so the clock never hides its own squeeze. The
 * day name is set enormous and nearly invisible: at that scale it reads as the axis
 * naming itself rather than as a heading.
 *
 * Everything inside is placed relative to the ground's own top-left corner, so clock
 * positions are shifted by the side margin exactly once, in `offsetFor`.
 */
import type { WaveClock } from './standing-wave-clock';

const GROUND_TOP_MARGIN = 120;
const GROUND_BOTTOM_MARGIN = 220;
const GROUND_SIDE_MARGIN = 180;

function offsetFor(clockX: number): string {
  return `${clockX + GROUND_SIDE_MARGIN}px`;
}

function QuietBands({ clock }: { clock: WaveClock }) {
  return (
    <>
      {clock.quietSpans.map((span) => (
        <div
          key={`quiet:${span.startX}`}
          className="wave-ground__quiet"
          style={{ left: offsetFor(span.startX), width: `${span.endX - span.startX}px` }}
        >
          <span>Quiet · {Math.max(1, Math.round(span.minutes / 60))}h</span>
        </div>
      ))}
    </>
  );
}

function DayWatermarks({ clock }: { clock: WaveClock }) {
  return (
    <>
      {clock.dayBands.map((band) => (
        <span
          key={`day:${band.label}:${band.startX}`}
          className="wave-ground__day"
          style={{ left: offsetFor(band.startX) }}
        >
          {band.label}
        </span>
      ))}
    </>
  );
}

function HourRuler({ clock }: { clock: WaveClock }) {
  return (
    <>
      {clock.hourTicks.map((tick) => (
        <div key={`hour:${tick.x}`} className="wave-ground__hour" style={{ left: offsetFor(tick.x) }}>
          <span>{tick.label}</span>
        </div>
      ))}
    </>
  );
}

/** Renders light, day, silence and hour marks beneath every lane. */
export function WaveGround({ clock, contentHeight }: { clock: WaveClock; contentHeight: number }) {
  const height = contentHeight + GROUND_TOP_MARGIN + GROUND_BOTTOM_MARGIN;
  const width = clock.nowX - clock.startX + GROUND_SIDE_MARGIN * 2;

  return (
    <div
      className="wave-ground"
      style={{
        left: `${clock.startX - GROUND_SIDE_MARGIN}px`,
        top: `${-GROUND_TOP_MARGIN}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <div className="wave-ground__light" />
      <DayWatermarks clock={clock} />
      <QuietBands clock={clock} />
      <HourRuler clock={clock} />
      <div className="wave-ground__now" style={{ left: offsetFor(clock.nowX) }}>
        <span>Now</span>
      </div>
    </div>
  );
}
