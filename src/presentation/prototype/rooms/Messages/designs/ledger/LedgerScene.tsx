/**
 * The ground the ledger rests on: grade, drafting grid, environmental signage, the
 * spine with its activity ticks, band tabs at spine tier, agent monograms filling
 * the field, and the hero lamp that lifts the active band out of the dark.
 *
 * Pure scenery — pointer-events none throughout. The signage drifts at 0.85× of the
 * camera's pan (a corrective transform computed from the live viewport), so the
 * floor visibly sits behind the ink.
 */
import type { CSSProperties } from 'react';
import { SPINE_X, BAND_WIDTH } from './ledger-geometry';

export type BandPlacement = {
  readonly id: string;
  readonly y: number;
  readonly height: number;
  readonly name: string;
  readonly monogram: string;
  readonly missionTitle: string;
  readonly unread: boolean;
  readonly ghost: boolean;
  readonly active: boolean;
  readonly amber: boolean;
  readonly released: boolean;
  readonly tick: number;
};

const SCENE_PAD_X = 1050;
const SCENE_PAD_Y = 760;

export function LedgerScene({
  placements,
  viewport,
  reduceMotion,
}: {
  placements: readonly BandPlacement[];
  viewport: { x: number; y: number; zoom: number };
  reduceMotion: boolean;
}) {
  if (placements.length === 0) return null;

  const top = placements[0].y - SCENE_PAD_Y;
  const bottom = placements[placements.length - 1].y + placements[placements.length - 1].height + SCENE_PAD_Y;
  const left = SPINE_X - SCENE_PAD_X;
  const width = BAND_WIDTH + 2 * SCENE_PAD_X;

  // Screen s = w·z + t. Rendering the signage at w − 0.15·t/z makes s = w·z + 0.85·t:
  // the ground pans slower than the ink, which is all a floor needs to read as a floor.
  const parallax: CSSProperties = reduceMotion
    ? {}
    : {
        transform: `translate(${(-0.15 * viewport.x) / viewport.zoom}px, ${(-0.15 * viewport.y) / viewport.zoom}px)`,
      };

  const active = placements.find((band) => band.active);

  return (
    <div className="ledger-scene" aria-hidden="true">
      <div
        className="ledger-scene__grade"
        style={{ left, top, width, height: bottom - top }}
      />
      <div
        className="ledger-scene__grid"
        style={{ left, top, width, height: bottom - top }}
      />

      <div className="ledger-scene__signage" style={parallax}>
        <span
          className="ledger-scene__signage-vertical"
          style={{ left: SPINE_X - 400, top: placements[0].y - 60 }}
        >
          Correspondence ledger
        </span>
        <span
          className="ledger-scene__signage-year"
          style={{ left: BAND_WIDTH - 240, top: placements[0].y - 210 }}
        >
          2026
        </span>
        {placements.map((band) => (
          <span
            key={`monogram:${band.id}`}
            className="ledger-scene__monogram"
            style={{ left: BAND_WIDTH + 60, top: band.y - 24 }}
          >
            {band.monogram}
          </span>
        ))}
      </div>

      {/* The hero lamp: one pool of light, under the band being read. */}
      {active && (
        <div
          className="ledger-scene__lamp"
          style={{
            left: SPINE_X - 420,
            top: active.y - 200,
            width: BAND_WIDTH + 920,
            height: active.height + 420,
          }}
        />
      )}

      <div
        className="ledger-scene__spine"
        style={{ left: SPINE_X, top: top + SCENE_PAD_Y - 180, height: bottom - top - 2 * SCENE_PAD_Y + 360 }}
      />

      {placements.map((band) => (
        <div key={band.id}>
          <span
            className="ledger-scene__tick"
            data-unread={band.unread}
            data-amber={band.amber}
            data-released={band.released}
            data-ghost={band.ghost}
            style={{ left: SPINE_X - band.tick, top: band.y + 18, width: band.tick }}
          />
          <div
            className="ledger-scene__tab"
            data-unread={band.unread}
            data-amber={band.amber}
            data-released={band.released}
            style={{ left: SPINE_X + 28, top: band.y }}
          >
            <strong>{band.name}</strong>
            <span>{band.missionTitle}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
