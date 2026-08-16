/**
 * Turns the Catenary model into canvas primitives.
 *
 * The canvas is a stage, not a list. One hero cable sits at the centre, readable and
 * beaded; a few neighbours hang off it for context; everything beyond that becomes a
 * single tally rather than a hundred lines of unreadable thread.
 */
import type { Edge, Node, NodeOrigin } from '@xyflow/react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import type { Cable, CatenaryModel } from './catenary-model';
import {
  STAGE_CONTEXT_EACH_SIDE,
  laneDepth,
  laneY,
  layOutCable,
  tallyY,
  type CableLayout,
} from './catenary-geometry';

/** The two semantic detail levels supported by Catenary. */
export type CatenaryTier = 'bundle' | 'reading';

type AnchorVariant = 'agentAnchor' | 'youAnchor';
type CableNodeVariant = AnchorVariant | 'bead' | 'tally';

type CableNodeData = Record<string, unknown> & {
  readonly variant: CableNodeVariant;
  readonly cableId: string;
  readonly record: ObjectRecord;
  readonly depth: number;
  readonly focused: boolean;
  readonly loaded: boolean;
  readonly agentName: string;
  readonly agentRole: string;
  readonly missionTitle: string | null;
  readonly body: string;
  readonly time: string;
  readonly mine: boolean;
  readonly waitingLabel: string | null;
  /** Only the tally uses these: how many conversations are off stage, and how many wait. */
  readonly offStageCount: number;
  readonly offStageWaiting: number;
};

type CableEdgeData = Record<string, unknown> & {
  readonly cableId: string;
  readonly sag: number;
  readonly depth: number;
  readonly focused: boolean;
  readonly loaded: boolean;
  readonly released: boolean;
};

/** An anchor or a single turn, placed on the cable it belongs to. */
export type CableNode = Node<CableNodeData, 'cableBead'>;

/** One conversation, drawn as a cable hanging under its own load. */
export type CableEdge = Edge<CableEdgeData, 'cable'>;

/** An hour numeral written into the floor beneath the focused cable. */
type FloorMark = { readonly x: number; readonly label: string };

/** Everything the floor needs to render under the focused cable. */
export type CatenaryFloor = {
  readonly laneY: number;
  readonly span: number;
  readonly marks: readonly FloorMark[];
  readonly dayLabel: string;
};

/** The complete canvas projection for one frame. */
type CatenaryProjection = {
  readonly nodes: readonly CableNode[];
  readonly edges: readonly CableEdge[];
  readonly floor: CatenaryFloor | null;
  readonly focusNodeId: string | null;
};

export const AGENT_ANCHOR_PREFIX = 'catenary-agent:';
export const YOU_ANCHOR_PREFIX = 'catenary-you:';

/** Anchors and beads are placed by the point they touch on the cable, not by a corner. */
const AGENT_ANCHOR_ORIGIN: NodeOrigin = [1, 0.5];
const YOU_ANCHOR_ORIGIN: NodeOrigin = [0, 0.5];
const BEAD_ORIGIN: NodeOrigin = [0.5, 0.5];

function hoursWaitingLabel(cable: Cable): string | null {
  if (!cable.load) return null;
  const hours = cable.load.hoursWaiting;
  if (hours < 1) return 'waiting minutes';
  if (hours < 48) return `waiting ${Math.round(hours)}h`;
  return `waiting ${Math.round(hours / 24)}d`;
}

function sentTime(record: ObjectRecord): string {
  const sent = new Date(field(record, 'createdAt'));
  return Number.isNaN(sent.getTime()) ? '' : sent.toISOString().slice(11, 16);
}

function anchorNode(
  cable: Cable,
  variant: AnchorVariant,
  slot: number,
  span: number,
): CableNode {
  const depth = laneDepth(slot);
  const focused = slot === 0;
  return {
    id: `${variant === 'agentAnchor' ? AGENT_ANCHOR_PREFIX : YOU_ANCHOR_PREFIX}${cable.record.id}`,
    type: 'cableBead',
    position: { x: variant === 'agentAnchor' ? 0 : span, y: laneY(slot) },
    data: {
      variant,
      cableId: cable.record.id,
      record: cable.record,
      depth,
      focused,
      loaded: Boolean(cable.load),
      agentName: cable.agentName,
      agentRole: cable.agentRole,
      missionTitle: cable.mission?.title ?? null,
      body: '',
      time: '',
      mine: false,
      waitingLabel: hoursWaitingLabel(cable),
      offStageCount: 0,
      offStageWaiting: 0,
    },
    origin: variant === 'agentAnchor' ? AGENT_ANCHOR_ORIGIN : YOU_ANCHOR_ORIGIN,
    draggable: false,
    selectable: variant === 'agentAnchor',
    zIndex: focused ? 20 : 10 - depth,
  };
}

/**
 * The conversations beyond the stage, as one quiet mark rather than unreadable lines.
 *
 * Selecting it stages the first of them, so nothing on the bundle is unreachable.
 */
function tallyNode(offStage: readonly Cable[], lowestSlot: number): CableNode | null {
  const next = offStage[0];
  if (!next) return null;
  return {
    id: `catenary-tally:${next.record.id}`,
    type: 'cableBead',
    position: { x: 0, y: tallyY(lowestSlot) },
    data: {
      variant: 'tally',
      cableId: next.record.id,
      record: next.record,
      depth: 2,
      focused: false,
      loaded: offStage.some((cable) => cable.load),
      agentName: next.agentName,
      agentRole: next.agentRole,
      missionTitle: null,
      body: '',
      time: '',
      mine: false,
      waitingLabel: null,
      offStageCount: offStage.length,
      offStageWaiting: offStage.filter((cable) => cable.load).length,
    },
    origin: AGENT_ANCHOR_ORIGIN,
    draggable: false,
    selectable: true,
    zIndex: 6,
  };
}

function beadNodes(cable: Cable, layout: CableLayout): CableNode[] {
  return cable.messages.map((message, messageIndex) => {
    const placement = layout.beads[messageIndex];
    const loaded = cable.load?.sourceMessageId === message.record.id;
    return {
      id: message.record.id,
      type: 'cableBead' as const,
      position: { x: placement?.offset ?? 0, y: placement?.drop ?? 0 },
      data: {
        variant: 'bead' as const,
        cableId: cable.record.id,
        record: message.record,
        depth: 0,
        focused: true,
        loaded,
        agentName: cable.agentName,
        agentRole: cable.agentRole,
        missionTitle: cable.mission?.title ?? null,
        body: field(message.record, 'body') || message.record.title,
        time: sentTime(message.record),
        mine: message.mine,
        waitingLabel: loaded ? hoursWaitingLabel(cable) : null,
        offStageCount: 0,
        offStageWaiting: 0,
      },
      origin: BEAD_ORIGIN,
      draggable: false,
      selectable: true,
      zIndex: loaded ? 30 : 22,
    };
  });
}

function cableEdge(
  cable: Cable,
  slot: number,
  sag: number,
  releasedCableId: string | null,
): CableEdge {
  return {
    id: `catenary-cable:${cable.record.id}`,
    source: `${AGENT_ANCHOR_PREFIX}${cable.record.id}`,
    target: `${YOU_ANCHOR_PREFIX}${cable.record.id}`,
    type: 'cable',
    data: {
      cableId: cable.record.id,
      sag,
      depth: laneDepth(slot),
      focused: slot === 0,
      loaded: Boolean(cable.load),
      released: releasedCableId === cable.record.id,
    },
    selectable: false,
    focusable: false,
    zIndex: slot === 0 ? 15 : 5,
  };
}

function floorFor(cable: Cable, layout: CableLayout): CatenaryFloor {
  const firstSent = new Date(field(cable.messages[0]?.record, 'createdAt'));
  return {
    laneY: 0,
    span: layout.span,
    marks: layout.beads.map((bead) => ({ x: bead.offset, label: bead.hourLabel })),
    dayLabel: Number.isNaN(firstSent.getTime())
      ? ''
      : firstSent.toISOString().slice(0, 10).replace(/-/g, ' '),
  };
}

/** The bead the camera should rest on: the load if there is one, else the last turn. */
function focusNodeId(cable: Cable | undefined): string | null {
  if (!cable) return null;
  return cable.load?.sourceMessageId
    ?? cable.messages.at(-1)?.record.id
    ?? `${AGENT_ANCHOR_PREFIX}${cable.record.id}`;
}

/** One cable on the stage, and how many lanes it sits from the hero. */
type StagedCable = { readonly cable: Cable; readonly slot: number };

/**
 * Picks the handful of cables the stage can actually show.
 *
 * The hero always takes slot zero. Its neighbours in the bundle fill the slots either
 * side, and anything that does not fit is left for the tally.
 */
function stageCables(cables: readonly Cable[], focusedIndex: number): {
  staged: readonly StagedCable[];
  offStage: readonly Cable[];
} {
  const size = STAGE_CONTEXT_EACH_SIDE * 2 + 1;
  const start = Math.max(0, Math.min(focusedIndex - STAGE_CONTEXT_EACH_SIDE, cables.length - size));
  const staged = cables
    .slice(start, start + size)
    .map((cable, offset) => ({ cable, slot: start + offset - focusedIndex }));
  const stagedIds = new Set(staged.map((entry) => entry.cable.record.id));

  return { staged, offStage: cables.filter((cable) => !stagedIds.has(cable.record.id)) };
}

/** Projects the staged cables, beading only the hero. */
export function projectCatenary(
  model: CatenaryModel,
  focusedCableId: string,
  tier: CatenaryTier,
  releasedCableId: string | null,
): CatenaryProjection {
  const focusedIndex = Math.max(
    0,
    model.cables.findIndex((cable) => cable.record.id === focusedCableId),
  );
  const { staged, offStage } = stageCables(model.cables, focusedIndex);
  const nodes: CableNode[] = [];
  const edges: CableEdge[] = [];
  let floor: CatenaryFloor | null = null;

  for (const { cable, slot } of staged) {
    const layout = layOutCable(cable);
    nodes.push(anchorNode(cable, 'agentAnchor', slot, layout.span));
    nodes.push(anchorNode(cable, 'youAnchor', slot, layout.span));
    edges.push(cableEdge(cable, slot, layout.sag, releasedCableId));

    if (slot !== 0 || tier !== 'reading') continue;
    nodes.push(...beadNodes(cable, layout));
    floor = floorFor(cable, layout);
  }

  const lowestSlot = staged.reduce((lowest, entry) => Math.max(lowest, entry.slot), 0);
  const tally = tallyNode(offStage, lowestSlot);
  if (tally) nodes.push(tally);

  return { nodes, edges, floor, focusNodeId: focusNodeId(model.cables[focusedIndex]) };
}
