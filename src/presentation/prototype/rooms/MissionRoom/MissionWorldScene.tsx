import type { CSSProperties } from 'react';
import type { Layout } from '../../interaction/reveal-tree';
import { field } from '../../object-graph/graph';
import { missionHeroProjection } from './mission-hero-geometry';
import type { MissionZoomTier } from './mission-semantic-zoom';
import './mission-world-scene.css';

function scenePosition(layout: Layout, x: number, y: number): CSSProperties {
  return { left: x - layout.bounds.x, top: y - layout.bounds.y };
}

/** The architectural ground that makes Mission Flow read as one constructed place. */
export function MissionWorldScene({
  layout,
  selectedId,
  tier,
  title,
}: {
  layout: Layout;
  selectedId: string | null;
  tier: MissionZoomTier;
  title: string;
}) {
  const roots = layout.nodes.filter((node) => node.depth === 0);
  const projectedRoots = roots.map((root) => ({
    placed: root,
    point: missionHeroProjection(root, layout, tier, root.record.id === selectedId),
  }));
  const selected = layout.nodes.find((node) => node.record.id === selectedId);
  const selectedPoint = selected
    ? missionHeroProjection(selected, layout, tier, true)
    : null;
  const landmark = projectedRoots.find(({ placed }) => field(placed.record, 'status') === 'active')
    ?? projectedRoots[0];
  const first = projectedRoots[0]?.point;
  const last = projectedRoots.at(-1)?.point;
  const deltaX = first && last ? last.x - first.x : 0;
  const deltaY = first && last ? last.y - first.y : 1;
  const chassisAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
  const chassisLength = Math.hypot(deltaX, deltaY) + 360;
  const depths = Array.from({ length: layout.maxDepth + 1 }, (_, depth) => depth);

  return (
    <div
      className="mission-world-scene"
      data-tier={tier}
      style={{
        left: layout.bounds.x,
        top: layout.bounds.y,
        width: layout.bounds.width,
        height: layout.bounds.height,
      }}
      aria-hidden="true"
    >
      <div className="mission-world-scene__grade" />
      <div className="mission-world-scene__grid" />
      <div className="mission-world-scene__horizon" />

      {first && (
        <div
          className="mission-world-scene__chassis"
          style={{
            ...scenePosition(layout, first.x, first.y),
            width: chassisLength,
            transform: `translate(-180px, -50%) rotate(${chassisAngle}deg)`,
          }}
        >
          <span className="mission-world-scene__chassis-top" />
          <span className="mission-world-scene__chassis-rail mission-world-scene__chassis-rail--north" />
          <span className="mission-world-scene__chassis-rail mission-world-scene__chassis-rail--south" />
          <span className="mission-world-scene__chassis-ribs" />
          <span className="mission-world-scene__chassis-face" />
          <strong>Execution chassis / {String(roots.length).padStart(2, '0')} stations</strong>
        </div>
      )}

      {landmark && (
        <div
          className="mission-world-scene__landmark-field"
          style={scenePosition(layout, landmark.point.x, landmark.point.y)}
        >
          <span />
          <i />
          <b>Current execution</b>
        </div>
      )}

      <div className="mission-world-scene__datum" style={{ left: 38, top: 38 }}>
        <span>Mission execution section</span>
        <strong>{title}</strong>
        <small>World projection · drag to rearrange · scroll to change scale</small>
      </div>

      {projectedRoots.map(({ placed, point }) => (
        <div
          key={`station:${placed.record.id}`}
          className="mission-world-scene__station"
          data-status={field(placed.record, 'status')}
          style={scenePosition(layout, point.x, point.y)}
        >
          <span className="mission-world-scene__station-line" />
          <b>{placed.sequenceLabel}</b>
          <i />
        </div>
      ))}

      {depths.map((depth) => (
        <div
          key={`depth:${depth}`}
          className="mission-world-scene__depth"
          data-depth={depth}
          style={{
            left: (first?.x ?? 260) - layout.bounds.x + depth * 540 - 120,
            top: (first?.y ?? 160) - layout.bounds.y - 182,
          }}
        >
          <span>{depth === 0 ? 'Primary execution' : `Structure depth ${depth}`}</span>
          <i />
        </div>
      ))}

      {last && (
        <div
          className="mission-world-scene__hero-title"
          style={scenePosition(layout, Math.max(170, last.x - 430), last.y + 178)}
        >
          <span>Mission world</span>
          <strong>{title}</strong>
          <i>{roots[0]?.sequenceLabel} — {roots.at(-1)?.sequenceLabel}</i>
        </div>
      )}

      {selectedPoint && (
        <div
          className="mission-world-scene__selection-field"
          style={scenePosition(layout, selectedPoint.x, selectedPoint.y)}
        >
          <span />
          <i />
        </div>
      )}

      <div className="mission-world-scene__scale" style={{ left: 44, bottom: 38 }}>
        <span>Depth</span><i /><b>Near</b><i /><b>Working</b><i /><b>Far</b>
      </div>
    </div>
  );
}
