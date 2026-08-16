/**
 * Where every object stands on the floor, and why.
 *
 * Pure arithmetic: radius comes from the turn band, angle from the sector its Mission
 * owns, size from how much has been said, tier from how far out it sits. Nothing here
 * reads the graph and nothing here decides colour — position is the whole job.
 */
import { TURN_BANDS, type OrbitBody, type OrbitField, type TurnBand } from './orbit-model';

/** The floor is seen at a shallow angle, so a circle lands as this ellipse. */
export const FLOOR_SQUASH = 0.52;

/** Where the axis ticks live. No conversation is placed into this wedge. */
const AXIS_ANGLE = 180;
const AXIS_RESERVE_DEG = 56;

const SECTOR_GAP_DEG = 7;
const MIN_SECTOR_DEG = 16;
/** Same band, same sector: nudge outward so two conversations never share a spot. */
const CROWD_STAGGER_PX = 15;

const RING_FRACTION: Record<TurnBand, number> = {
  now: 0.36,
  hours: 0.52,
  today: 0.74,
  quiet: 0.94,
};

/** Detail falls away with distance, the way it does across a real floor. */
const BAND_TIER: Record<TurnBand, 'near' | 'mid' | 'far'> = {
  now: 'near',
  hours: 'near',
  today: 'mid',
  quiet: 'far',
};

export type FieldSize = { readonly width: number; readonly height: number };

export type PlacedBody = {
  readonly body: OrbitBody;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly angle: number;
  readonly radius: number;
  readonly tier: 'near' | 'mid' | 'far';
  /** Unit vector pointing away from the core: the direction light falls. */
  readonly shadeX: number;
  readonly shadeY: number;
};

export type PlacedGroup = {
  readonly id: string;
  readonly label: string;
  readonly standalone: boolean;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly midAngle: number;
};

export type FieldLayout = {
  readonly cx: number;
  readonly cy: number;
  readonly outerRadius: number;
  readonly ringRadius: Record<TurnBand, number>;
  readonly bodies: readonly PlacedBody[];
  readonly groups: readonly PlacedGroup[];
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** A point on the floor ellipse. Angle 0 is right of the core; angle grows clockwise. */
export function pointOnFloor(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: cx + radius * Math.cos(toRadians(angle)),
    y: cy + radius * Math.sin(toRadians(angle)) * FLOOR_SQUASH,
  };
}

/** An elliptical arc between two angles. */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  fromAngle: number,
  toAngle: number,
  sweep: 0 | 1 = 1,
): string {
  const from = pointOnFloor(cx, cy, radius, fromAngle);
  const to = pointOnFloor(cx, cy, radius, toAngle);
  const largeArc = Math.abs(toAngle - fromAngle) > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${radius} ${radius * FLOOR_SQUASH} 0 ${largeArc} ${sweep} ${to.x} ${to.y}`;
}

/**
 * The same arc, drawn in whichever direction keeps lettering the right way up.
 *
 * Text set on the near edge of the floor has to run the other way round the ellipse,
 * which is the difference between a label and a mirror image.
 */
export function uprightArcPath(
  cx: number,
  cy: number,
  radius: number,
  fromAngle: number,
  toAngle: number,
): string {
  const runsAlongNearEdge = Math.sin(toRadians((fromAngle + toAngle) / 2)) > 0;
  return runsAlongNearEdge
    ? arcPath(cx, cy, radius, toAngle, fromAngle, 0)
    : arcPath(cx, cy, radius, fromAngle, toAngle, 1);
}

function sectorWidths(field: OrbitField): number[] {
  const available = 360 - AXIS_RESERVE_DEG - field.groups.length * SECTOR_GAP_DEG;
  const total = field.bodies.length || 1;
  const raw = field.groups.map((group) => Math.max(MIN_SECTOR_DEG, (available * group.count) / total));
  const scale = available / (raw.reduce((sum, width) => sum + width, 0) || 1);
  return raw.map((width) => width * scale);
}

function placeGroups(field: OrbitField): PlacedGroup[] {
  const widths = sectorWidths(field);
  let cursor = AXIS_ANGLE + AXIS_RESERVE_DEG / 2;

  return field.groups.map((group, index) => {
    const startAngle = cursor;
    const endAngle = startAngle + widths[index];
    cursor = endAngle + SECTOR_GAP_DEG;
    return {
      id: group.id,
      label: group.label,
      standalone: group.standalone,
      startAngle,
      endAngle,
      midAngle: (startAngle + endAngle) / 2,
    };
  });
}

function bodySize(body: OrbitBody): number {
  const spoken = Math.min(Math.max(body.messageCount, 1), 10);
  return 20 + spoken * 3.2;
}

/** Places every conversation. Nothing is dropped, so the floor never truncates. */
export function layoutField(field: OrbitField, size: FieldSize): FieldLayout {
  const cx = size.width * 0.4;
  const cy = size.height * 0.53;
  const outerRadius = Math.max(150, Math.min(size.width * 0.34, size.height * 0.62));

  const ringRadius = {
    now: outerRadius * RING_FRACTION.now,
    hours: outerRadius * RING_FRACTION.hours,
    today: outerRadius * RING_FRACTION.today,
    quiet: outerRadius * RING_FRACTION.quiet,
  } satisfies Record<TurnBand, number>;

  const groups = placeGroups(field);
  const crowding = new Map<string, number>();
  const bodies: PlacedBody[] = [];

  for (const group of groups) {
    const members = field.bodies.filter((body) => body.groupId === group.id);
    const span = group.endAngle - group.startAngle;

    members.forEach((body, index) => {
      const angle = group.startAngle + (span * (index + 0.5)) / members.length;
      const crowdKey = `${group.id}:${body.band}`;
      const alreadyHere = crowding.get(crowdKey) ?? 0;
      crowding.set(crowdKey, alreadyHere + 1);

      const radius = ringRadius[body.band] + alreadyHere * CROWD_STAGGER_PX;
      const point = pointOnFloor(cx, cy, radius, angle);
      const shade = pointOnFloor(0, 0, 1, angle);

      bodies.push({
        body,
        x: point.x,
        y: point.y,
        radius,
        angle,
        size: bodySize(body),
        tier: BAND_TIER[body.band],
        shadeX: Number(shade.x.toFixed(3)),
        shadeY: Number(shade.y.toFixed(3)),
      });
    });
  }

  return { cx, cy, outerRadius, ringRadius, bodies, groups };
}

/** The ring ticks, innermost first, as the axis legend and the floor both read them. */
export const RING_TICKS = TURN_BANDS;

/**
 * Trims a label to the arc that carries it.
 *
 * Lettering set past the end of its path is clipped by the renderer with no sign that
 * anything is missing. An ellipsis is the sign; the full name is one press away on the
 * tether caption and in the reading surface.
 */
export function fitToArc(
  label: string,
  radius: number,
  spanDegrees: number,
  midAngle: number,
  advancePx: number,
): string {
  // On the flanks the floor ellipse compresses the path, so the same span carries
  // far fewer characters there than it does across the near or far edge.
  const mid = toRadians(midAngle);
  const compression = Math.abs(Math.sin(mid)) + FLOOR_SQUASH * Math.abs(Math.cos(mid));
  const arcLength = radius * toRadians(spanDegrees) * compression;
  const capacity = Math.floor(arcLength / advancePx);
  if (capacity >= label.length) return label;
  return capacity > 1 ? `${label.slice(0, capacity - 1).trimEnd()}…` : '…';
}
