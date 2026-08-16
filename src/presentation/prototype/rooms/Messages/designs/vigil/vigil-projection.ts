/**
 * Turns the Vigil model into the canvas nodes and edges React Flow renders.
 *
 * Only the opened conversation contributes moments and rays, so the floor can never
 * fill with connectors: at most one conversation is ever unfurled at a time.
 */
import type { Edge, Node } from '@xyflow/react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import {
  momentSeats,
  seatLanterns,
  type FloorPoint,
  type LanternSeat,
  type VigilDepth,
} from './vigil-geometry';
import type { VigilLantern, VigilModel } from './vigil-model';

/** The node id of the ring at the centre of the floor. */
export const HERO_NODE_ID = 'vigil-hero';

/** How many moments keep their words before the rest collapse into beads. */
const READABLE_MOMENTS = 3;

/**
 * The drawn size of a moment. These must match the stylesheet, because the geometry
 * spaces the ray by them — a card wider than this is a card that overlaps its neighbour.
 */
const MOMENT_WIDTH = 300;
const MOMENT_HEIGHT = 132;
const BEAD_SIZE = 16;

type HeroData = Record<string, unknown> & {
  readonly waitingCount: number;
  readonly liveCount: number;
  readonly hasAttention: boolean;
  readonly onFollowAttention: () => void;
};

type LanternData = Record<string, unknown> & {
  readonly record: ObjectRecord;
  readonly agentName: string;
  readonly agentRole: string;
  readonly silence: string;
  readonly bandLabel: string;
  readonly depth: VigilDepth;
  readonly width: number;
  /** The ring this lantern belongs to. Dragging may slide it around, never off. */
  readonly bandRadiusX: number;
  readonly attention: boolean;
  readonly awaitingReply: boolean;
  readonly opened: boolean;
  /** Rendered only for the opened lantern, and only when the thread has a Mission. */
  readonly missionTitle: string | null;
  readonly preview: string;
  readonly onOpen: (threadId: string) => void;
};

type MomentData = Record<string, unknown> & {
  readonly record: ObjectRecord;
  readonly speaker: string;
  readonly mine: boolean;
  readonly body: string;
  readonly time: string;
  readonly collapsed: boolean;
  readonly referenceCount: number;
};

type RayData = Record<string, unknown> & {
  readonly fade: number;
};

/** The ring marking your own position at the centre of the floor. */
export type HeroFlowNode = Node<HeroData, 'vigilHero'>;

/** One conversation, seated at the distance of its silence. */
export type LanternFlowNode = Node<LanternData, 'vigilLantern'>;

/** One message of the opened conversation, seated by its age. */
export type MomentFlowNode = Node<MomentData, 'vigilMoment'>;

/** Any node Vigil puts on the floor. */
export type VigilFlowNode = HeroFlowNode | LanternFlowNode | MomentFlowNode;

/** A segment of the opened conversation's ray. */
export type RayFlowEdge = Edge<RayData, 'vigilRay'>;

/** Callbacks the canvas hands to its nodes. Nodes never reach the host directly. */
type VigilProjectionActions = {
  onOpen(threadId: string): void;
  onFollowAttention(): void;
};

function timeLabel(record: ObjectRecord): string {
  const parsed = new Date(field(record, 'createdAt'));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(11, 16);
}

function previewOf(lantern: VigilLantern): string {
  return lantern.moments[0]?.record.title ?? 'No messages yet';
}

/** Reads a silence in the words a person would use, never as a raw timestamp. */
function silenceInWords(silentMinutes: number): string {
  if (silentMinutes < 2) return 'just now';
  if (silentMinutes < 60) return `${Math.round(silentMinutes)} minutes ago`;
  if (silentMinutes < 1_440) return `${Math.round(silentMinutes / 60)} hours ago`;
  return `${Math.round(silentMinutes / 1_440)} days ago`;
}

/** Seats every conversation from its silence. Index matches `model.lanterns`. */
function seatsFor(model: VigilModel): readonly LanternSeat[] {
  return seatLanterns(model.lanterns.map((lantern) => lantern.silentMinutes));
}

function heroNode(model: VigilModel, actions: VigilProjectionActions): HeroFlowNode {
  return {
    id: HERO_NODE_ID,
    type: 'vigilHero',
    position: { x: -170, y: -95 },
    draggable: false,
    selectable: false,
    data: {
      waitingCount: model.waitingCount,
      liveCount: model.lanterns.length,
      hasAttention: model.attentionLanternId !== null,
      onFollowAttention: actions.onFollowAttention,
    },
  };
}

function lanternNode(
  lantern: VigilLantern,
  seat: LanternSeat,
  openedThreadId: string | null,
  actions: VigilProjectionActions,
): LanternFlowNode {
  const opened = lantern.record.id === openedThreadId;

  return {
    id: `vigil-lantern:${lantern.record.id}`,
    type: 'vigilLantern',
    position: { x: seat.point.x - seat.width / 2, y: seat.point.y - 40 },
    data: {
      record: lantern.record,
      agentName: lantern.agentName,
      agentRole: lantern.agentRole,
      silence: silenceInWords(lantern.silentMinutes),
      bandLabel: seat.bandLabel,
      depth: seat.depth,
      width: seat.width,
      bandRadiusX: seat.bandRadiusX,
      attention: lantern.attention,
      awaitingReply: lantern.awaitingReply,
      opened,
      missionTitle: opened ? lantern.mission?.title ?? null : null,
      preview: previewOf(lantern),
      onOpen: actions.onOpen,
    },
  };
}

/** Seats every conversation on its ring, and marks the one that is open. */
function lanternNodes(
  model: VigilModel,
  seats: readonly LanternSeat[],
  openedThreadId: string | null,
  actions: VigilProjectionActions,
): LanternFlowNode[] {
  return model.lanterns.flatMap((lantern, index) => {
    const seat = seats[index];
    return seat ? [lanternNode(lantern, seat, openedThreadId, actions)] : [];
  });
}

/** Unfurls the opened conversation along its own ray, newest at the hem. */
function momentNodes(lantern: VigilLantern, lanternPoint: FloorPoint): MomentFlowNode[] {
  const extents = lantern.moments.map((moment, index) => (
    index >= READABLE_MOMENTS
      ? { minutesBefore: moment.minutesBeforePrevious, width: BEAD_SIZE, height: BEAD_SIZE }
      : { minutesBefore: moment.minutesBeforePrevious, width: MOMENT_WIDTH, height: MOMENT_HEIGHT }
  ));
  const seats = momentSeats(lanternPoint, extents);

  return lantern.moments.map((moment, index) => {
    const collapsed = index >= READABLE_MOMENTS;
    const point = seats[index] ?? lanternPoint;
    const extent = extents[index]!;

    return {
      id: `vigil-moment:${moment.record.id}`,
      type: 'vigilMoment' as const,
      position: { x: point.x - extent.width / 2, y: point.y - extent.height / 2 },
      draggable: false,
      data: {
        record: moment.record,
        speaker: moment.mine ? 'You' : lantern.agentName,
        mine: moment.mine,
        body: moment.record.title,
        time: timeLabel(moment.record),
        collapsed,
        referenceCount: moment.references.length,
      },
    };
  });
}

/** Chains the opened lantern to its moments, fading as the conversation recedes. */
function rayEdges(lantern: VigilLantern): RayFlowEdge[] {
  const stops = [`vigil-lantern:${lantern.record.id}`, ...lantern.moments.map(
    (moment) => `vigil-moment:${moment.record.id}`,
  )];

  return stops.slice(0, -1).map((source, index) => ({
    id: `vigil-ray:${index}:${lantern.record.id}`,
    type: 'vigilRay' as const,
    source,
    target: stops[index + 1]!,
    data: { fade: Math.max(0.12, 1 - index / Math.max(1, stops.length - 1)) },
  }));
}

/** Projects the whole floor: the hero ring, every lantern, and one unfurled conversation. */
export function projectVigilFloor(
  model: VigilModel,
  openedThreadId: string | null,
  actions: VigilProjectionActions,
): { nodes: VigilFlowNode[]; edges: RayFlowEdge[] } {
  const seats = seatsFor(model);
  const nodes: VigilFlowNode[] = [
    heroNode(model, actions),
    ...lanternNodes(model, seats, openedThreadId, actions),
  ];

  const openedIndex = model.lanterns.findIndex((lantern) => lantern.record.id === openedThreadId);
  const opened = model.lanterns[openedIndex];
  const openedPoint = seats[openedIndex]?.point ?? null;

  if (!opened || !openedPoint) return { nodes, edges: [] };

  return {
    nodes: [...nodes, ...momentNodes(opened, openedPoint)],
    edges: rayEdges(opened),
  };
}
