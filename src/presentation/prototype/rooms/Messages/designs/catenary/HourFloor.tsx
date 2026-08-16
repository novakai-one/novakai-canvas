import { FLOOR_DROP } from './catenary-geometry';
import type { CatenaryFloor } from './catenary-projection';

/**
 * The clock written into the floor beneath the focused cable.
 *
 * Distance along a cable is elapsed time, so the axis every bead is placed against
 * deserves to be visible. It is the largest thing in the room and the quietest.
 */
export function HourFloor({ floor }: { floor: CatenaryFloor }) {
  return (
    <div className="catenary-floor" style={{ transform: `translate(0px, ${floor.laneY + FLOOR_DROP}px)` }}>
      <span className="catenary-floor__day">{floor.dayLabel}</span>
      {floor.marks.map((mark, index) => (
        <span
          className="catenary-floor__hour"
          key={`${mark.x}:${index}`}
          style={{ transform: `translateX(${mark.x}px)` }}
        >
          {mark.label}
        </span>
      ))}
      <span className="catenary-floor__now" style={{ transform: `translateX(${floor.span}px)` }}>
        now
      </span>
    </div>
  );
}
