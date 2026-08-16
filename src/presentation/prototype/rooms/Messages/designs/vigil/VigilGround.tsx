import { RING_FLATTENING, VIGIL_BANDS } from './vigil-geometry';

/**
 * The floor itself: one ellipse per silence band, each named in ghosted type.
 *
 * The rings are read at an angle rather than face-on, which is what makes the canvas
 * a floor instead of a target. The names are the only labelling the axis needs, and
 * they sit at four per cent ink so they read as ground rather than as content.
 */
export function VigilGround() {
  const outer = VIGIL_BANDS[VIGIL_BANDS.length - 1]!.radiusX + 240;

  return (
    <svg
      className="vigil-ground"
      width={outer * 2}
      height={outer * 2 * RING_FLATTENING}
      viewBox={`${-outer} ${-outer * RING_FLATTENING} ${outer * 2} ${outer * 2 * RING_FLATTENING}`}
      style={{ left: -outer, top: -outer * RING_FLATTENING }}
      aria-hidden="true"
    >
      {VIGIL_BANDS.map((band) => (
        <ellipse
          key={band.id}
          className="vigil-ground__ring"
          cx={0}
          cy={0}
          rx={band.radiusX}
          ry={band.radiusX * RING_FLATTENING}
        />
      ))}
      {VIGIL_BANDS.map((band) => (
        <text
          key={`${band.id}-label`}
          className="vigil-ground__band-name"
          x={0}
          y={band.radiusX * RING_FLATTENING - 26}
          textAnchor="middle"
        >
          {band.label.toUpperCase()}
        </text>
      ))}
    </svg>
  );
}
