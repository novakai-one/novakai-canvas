import type { MissionField } from './atlas-geometry';

export function AtlasTerrainScene({ fields }: { fields: readonly MissionField[] }) {
  return (
    <div className="atlas-terrain" aria-hidden="true">
      <div className="atlas-terrain__meridian" />
      {fields.map((field, index) => (
        <div
          className="atlas-terrain__basin"
          key={field.id}
          style={{
            left: field.center.x - field.radius,
            top: field.center.y - field.radius,
            width: field.radius * 2,
            height: field.radius * 2,
            '--basin-index': index,
          } as React.CSSProperties}
        >
          <i className="atlas-terrain__contour atlas-terrain__contour--outer" />
          <i className="atlas-terrain__contour atlas-terrain__contour--middle" />
          <i className="atlas-terrain__contour atlas-terrain__contour--inner" />
          <span className="atlas-terrain__bearing">{String(index + 1).padStart(2, '0')} / BASIN</span>
        </div>
      ))}
    </div>
  );
}
