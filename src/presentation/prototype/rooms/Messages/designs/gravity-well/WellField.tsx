/**
 * The floor itself: light pool, rings, axis ticks, sector arcs, wordmark, tether.
 *
 * The ground is drawn once in SVG so the conversations standing on it have something
 * measurable to stand on — the rings are the axis, the sector arcs are the Missions,
 * and the one tether names a relationship instead of implying it.
 */
import { OrbitBody } from './OrbitBody';
import {
  RING_TICKS,
  arcPath,
  fitToArc,
  pointOnFloor,
  uprightArcPath,
  type FieldLayout,
  type PlacedBody,
} from './orbit-geometry';
import type { OrbitBody as OrbitBodyModel, OrbitField } from './orbit-model';

const SECTOR_ARC_OFFSET = 28;
const WORDMARK_RADIUS_FRACTION = 0.82;
const CORE_RADIUS = 58;
/** Width of one uppercase mono character at the sector label's size and tracking. */
const SECTOR_LABEL_ADVANCE = 10;

function pathId(prefix: string, key: string): string {
  return `gw-${prefix}-${key.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** The line from the open conversation to the sector that owns it, captioned once. */
function Tether({ layout, placed }: { layout: FieldLayout; placed: PlacedBody }) {
  const group = layout.groups.find((candidate) => candidate.id === placed.body.groupId);
  if (!group) return null;

  const anchor = pointOnFloor(layout.cx, layout.cy, layout.outerRadius + SECTOR_ARC_OFFSET, group.midAngle);
  const runsRightToLeft = anchor.x < placed.x;
  const from = runsRightToLeft ? anchor : { x: placed.x, y: placed.y };
  const to = runsRightToLeft ? { x: placed.x, y: placed.y } : anchor;
  const id = pathId('tether', placed.body.thread.id);
  const caption = group.standalone
    ? `direct · ${placed.body.agent?.title ?? 'agent'}`
    : `belongs to · ${group.label}`;

  return (
    <g className="gw-tether" data-pending={placed.body.awaitingYou}>
      <path id={id} d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} fill="none" />
      <use href={`#${id}`} className="gw-tether__line" />
      <text className="gw-tether__caption" dy={-6}>
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {caption}
        </textPath>
      </text>
    </g>
  );
}

export function WellField({
  layout,
  field,
  activeThreadId,
  selectedId,
  releasedIds,
  onOpen,
}: {
  layout: FieldLayout;
  field: OrbitField;
  activeThreadId: string | null;
  selectedId: string | null;
  releasedIds: ReadonlySet<string>;
  onOpen(body: OrbitBodyModel): void;
}) {
  const { cx, cy, outerRadius, ringRadius } = layout;
  const active = layout.bodies.find((placed) => placed.body.thread.id === activeThreadId);
  const awaitingShare = field.bodies.length ? field.awaitingCount / field.bodies.length : 0;
  const wordmarkRadius = outerRadius * WORDMARK_RADIUS_FRACTION;

  return (
    <div className="gw-field">
      <svg className="gw-floor" aria-hidden="true">
        <defs>
          <radialGradient id="gw-pool" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(236, 236, 238, 0.06)" />
            <stop offset="55%" stopColor="rgba(236, 236, 238, 0.02)" />
            <stop offset="100%" stopColor="rgba(13, 13, 15, 0)" />
          </radialGradient>
          <radialGradient id="gw-core" cx="50%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#26262b" />
            <stop offset="70%" stopColor="#161619" />
            <stop offset="100%" stopColor="#0a0a0c" />
          </radialGradient>
        </defs>

        {/* The pool of light the core casts across the floor. */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={outerRadius * 1.12}
          ry={outerRadius * 1.12 * 0.52}
          fill="url(#gw-pool)"
        />

        {/* The floor names itself, set into the surface rather than printed on it. */}
        <path id="gw-wordmark-path" d={uprightArcPath(cx, cy, wordmarkRadius, 40, 140)} fill="none" />
        <text className="gw-wordmark" fontSize={outerRadius * 0.19}>
          <textPath href="#gw-wordmark-path" startOffset="50%" textAnchor="middle">
            MESSAGES
          </textPath>
        </text>

        {/* The radial axis: one ring per turn band. */}
        {RING_TICKS.map((band) => (
          <ellipse
            key={band}
            className="gw-ring"
            data-band={band}
            cx={cx}
            cy={cy}
            rx={ringRadius[band]}
            ry={ringRadius[band] * 0.52}
          />
        ))}
        {RING_TICKS.map((band) => (
          <text key={`tick-${band}`} className="gw-tick" x={cx - ringRadius[band] - 8} y={cy - 6} textAnchor="end">
            {band}
          </text>
        ))}

        {/* One arc per sector. A direct thread's sector is drawn exactly like a Mission's. */}
        {layout.groups.map((group) => {
          const id = pathId('sector', group.id);
          return (
            <g key={group.id} className="gw-sector" data-standalone={group.standalone}>
              <path
                id={id}
                className="gw-sector__arc"
                d={uprightArcPath(cx, cy, outerRadius + SECTOR_ARC_OFFSET, group.startAngle, group.endAngle)}
                fill="none"
              />
              <text className="gw-sector__label" dy={-8}>
                <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
                  {fitToArc(
                    group.label,
                    outerRadius + SECTOR_ARC_OFFSET,
                    group.endAngle - group.startAngle,
                    group.midAngle,
                    SECTOR_LABEL_ADVANCE,
                  )}
                </textPath>
              </text>
            </g>
          );
        })}

        {active && <Tether layout={layout} placed={active} />}

        {/* The core: you, and the share of conversations whose turn is yours. */}
        <ellipse className="gw-core" cx={cx} cy={cy} rx={CORE_RADIUS} ry={CORE_RADIUS * 0.52} fill="url(#gw-core)" />
        <ellipse
          className="gw-core__rim"
          cx={cx}
          cy={cy}
          rx={CORE_RADIUS + 12}
          ry={(CORE_RADIUS + 12) * 0.52}
        />
        {awaitingShare > 0 && (
          <path
            className="gw-core__share"
            d={arcPath(cx, cy, CORE_RADIUS + 12, -90, -90 + 360 * awaitingShare)}
            fill="none"
          />
        )}
        <text className="gw-core__count" x={cx} y={cy + 1} textAnchor="middle">
          {field.awaitingCount}
        </text>
        <text className="gw-core__label" x={cx} y={cy + 17} textAnchor="middle">
          awaiting you
        </text>
      </svg>

      {layout.bodies.map((placed) => (
        <OrbitBody
          key={placed.body.thread.id}
          placed={placed}
          state={{
            active: placed.body.thread.id === activeThreadId,
            selected: placed.body.thread.id === selectedId,
            elected: placed.body.thread.id === field.electedThreadId,
            released: releasedIds.has(placed.body.thread.id),
          }}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
