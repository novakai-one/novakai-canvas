/**
 * The landscape under the chains: ground typography, the spine roots hang from, the
 * horizon settled work sinks beneath, and one near-invisible wash per chain so each
 * reads as territory rather than a row. World-space via canvasChildren, so all of it
 * pans and zooms with the field — the MissionWorldScene pattern.
 */
import type { FieldLayout } from './field-layout';
import type { FieldTier } from './field-semantic-zoom';

export function FieldScene({ layout, tier }: { layout: FieldLayout; tier: FieldTier }) {
  const { bounds, bands, spineX, horizonY } = layout;

  return (
    <div
      className="field-scene"
      data-tier={tier}
      aria-hidden="true"
      style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }}
    >
      <span
        className="field-scene__ground-word"
        style={{ left: spineX - bounds.x - 120, top: horizonY - bounds.y + 60 }}
      >
        Causal field
      </span>

      {bands.map((band) => (
        <span
          key={`band:${band.chainIndex}`}
          className="field-scene__band"
          style={{
            left: spineX - bounds.x - 160,
            top: band.top - bounds.y,
            width: Math.max(1, band.reach) * 340 + 420,
            height: band.height,
          }}
        />
      ))}

      <span
        className="field-scene__spine"
        style={{
          left: spineX - bounds.x,
          top: (bands[0]?.top ?? 0) - bounds.y - 40,
          height: horizonY - (bands[0]?.top ?? 0) + 16,
        }}
      />
      {bands.map((band) => (
        <span
          key={`tick:${band.chainIndex}`}
          className="field-scene__tick"
          style={{ left: spineX - bounds.x, top: band.top + band.height / 2 - bounds.y }}
        />
      ))}

      <span className="field-scene__horizon" style={{ top: horizonY - bounds.y }} />
      <span className="field-scene__underworld" style={{ top: horizonY - bounds.y }} />
      <span
        className="field-scene__horizon-word"
        style={{ left: spineX - bounds.x + 8, top: horizonY - bounds.y + 14 }}
      >
        settled
      </span>
    </div>
  );
}
