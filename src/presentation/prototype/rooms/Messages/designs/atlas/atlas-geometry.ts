import type { ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';

export type Point = { x: number; y: number };
export type LandmarkVariant = 'mission' | 'agent' | 'thread' | 'message' | 'reference';
export type RouteKind = 'chronology' | 'attachment' | 'reference';

export type AtlasLandmark = {
  id: string;
  record: ObjectRecord;
  variant: LandmarkVariant;
  position: Point;
  width: number;
  height: number;
  threadId?: string;
  missionId?: string;
  agentId?: string;
  subtitle?: string;
  body?: string;
  meta?: string;
  status?: string;
  unread?: boolean;
  mine?: boolean;
  sequence?: number;
};

export type AtlasConnection = {
  id: string;
  source: string;
  target: string;
  kind: RouteKind;
  threadId?: string;
  order?: number;
};

export type MissionField = {
  id: string;
  title: string;
  center: Point;
  radius: number;
  threadCount: number;
  status: string;
};

export type AtlasGeometry = {
  landmarks: AtlasLandmark[];
  connections: AtlasConnection[];
  missionFields: MissionField[];
  nodeIdsByThread: Map<string, string[]>;
  overviewNodeIds: string[];
};

type Cubic = { start: Point; c1: Point; c2: Point; end: Point };

function cubicPoint(curve: Cubic, t: number): Point {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * curve.start.x +
      3 * mt * mt * t * curve.c1.x +
      3 * mt * t * t * curve.c2.x +
      t * t * t * curve.end.x,
    y:
      mt * mt * mt * curve.start.y +
      3 * mt * mt * t * curve.c1.y +
      3 * mt * t * t * curve.c2.y +
      t * t * t * curve.end.y,
  };
}

function cubicNormal(curve: Cubic, t: number): Point {
  const mt = 1 - t;
  const dx =
    3 * mt * mt * (curve.c1.x - curve.start.x) +
    6 * mt * t * (curve.c2.x - curve.c1.x) +
    3 * t * t * (curve.end.x - curve.c2.x);
  const dy =
    3 * mt * mt * (curve.c1.y - curve.start.y) +
    6 * mt * t * (curve.c2.y - curve.c1.y) +
    3 * t * t * (curve.end.y - curve.c2.y);
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function newestThreadTime(graph: ObjectGraph, mission: ObjectRecord): number {
  return Math.max(
    0,
    ...graph.relatedOfKind(mission.id, 'discussedIn', 'thread').map((thread) => {
      const value = Date.parse(field(thread, 'ts') || thread.createdAt);
      return Number.isNaN(value) ? 0 : value;
    }),
  );
}

function messagesOf(graph: ObjectGraph, thread: ObjectRecord): ObjectRecord[] {
  return graph
    .relatedOfKind(thread.id, 'contains', 'message')
    .slice()
    .sort((a, b) => field(a, 'createdAt').localeCompare(field(b, 'createdAt')));
}

function clock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Pure projection of graph meaning into a recoverable, panoramic layout. */
export function buildAtlasGeometry(
  graph: ObjectGraph,
  threads: readonly ObjectRecord[],
  unreadIds: ReadonlySet<string>,
): AtlasGeometry {
  const missions = Array.from(
    new Map(
      threads
        .flatMap((thread) => graph.relatedOfKind(thread.id, 'discusses', 'mission'))
        .map((mission) => [mission.id, mission]),
    ).values(),
  ).sort((a, b) => newestThreadTime(graph, b) - newestThreadTime(graph, a));

  const missionCenters = new Map<string, Point>();
  const missionFields: MissionField[] = [];
  const landmarks: AtlasLandmark[] = [];
  const connections: AtlasConnection[] = [];
  const nodeIdsByThread = new Map<string, string[]>();
  const overviewNodeIds: string[] = [];
  const claimedAgents = new Set<string>();
  const claimedReferences = new Set<string>();

  missions.forEach((mission, index) => {
    const center = {
      x: 520 + index * 1320,
      y: 440 + (index % 2 === 0 ? -1 : 1) * 320,
    };
    const missionThreads = threads.filter((thread) =>
      graph.relatedOfKind(thread.id, 'discusses', 'mission').some((item) => item.id === mission.id),
    );
    const radius = 280 + Math.min(2, Math.max(0, missionThreads.length - 1)) * 42;
    missionCenters.set(mission.id, center);
    missionFields.push({
      id: mission.id,
      title: mission.title,
      center,
      radius,
      threadCount: missionThreads.length,
      status: field(mission, 'status'),
    });
    landmarks.push({
      id: mission.id,
      record: mission,
      variant: 'mission',
      position: { x: center.x - 160, y: center.y - 74 },
      width: 320,
      height: 148,
      subtitle: `${missionThreads.length} ${missionThreads.length === 1 ? 'route' : 'routes'}`,
      status: field(mission, 'status'),
      missionId: mission.id,
    });
    overviewNodeIds.push(mission.id);
  });

  const orphanCenter = { x: 520 + missions.length * 1320, y: 120 };
  const sortedThreads = [...threads].sort((a, b) => a.id.localeCompare(b.id));

  for (const thread of sortedThreads) {
    const mission = graph.relatedOfKind(thread.id, 'discusses', 'mission')[0];
    const agent = graph.relatedOfKind(thread.id, 'discusses', 'agent')[0];
    const siblings = mission
      ? sortedThreads.filter((candidate) =>
          graph.relatedOfKind(candidate.id, 'discusses', 'mission').some((item) => item.id === mission.id),
        )
      : [thread];
    const siblingIndex = siblings.findIndex((candidate) => candidate.id === thread.id);
    const center = (mission && missionCenters.get(mission.id)) ?? orphanCenter;
    const radius = 530 + siblingIndex * 105;
    const angle = (-142 + siblingIndex * (siblings.length > 1 ? 70 : 0)) * (Math.PI / 180);
    const agentCenter = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
    const start = agentCenter;
    const end = { x: center.x - 116, y: center.y + 14 };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const curve: Cubic = {
      start,
      c1: { x: start.x + dx * 0.34, y: start.y + dy * 0.06 - 115 },
      c2: { x: start.x + dx * 0.68, y: start.y + dy * 0.94 + 100 },
      end,
    };
    const routeIds: string[] = [];

    if (agent && !claimedAgents.has(agent.id)) {
      claimedAgents.add(agent.id);
      landmarks.push({
        id: agent.id,
        record: agent,
        variant: 'agent',
        position: { x: agentCenter.x - 54, y: agentCenter.y - 54 },
        width: 108,
        height: 108,
        subtitle: 'Agent outpost',
        status: field(agent, 'status'),
        agentId: agent.id,
        missionId: mission?.id,
      });
      overviewNodeIds.push(agent.id);
    }

    const gate = cubicPoint(curve, 0.13);
    landmarks.push({
      id: thread.id,
      record: thread,
      variant: 'thread',
      position: { x: gate.x - 102, y: gate.y - 32 },
      width: 204,
      height: 64,
      subtitle: mission?.title ?? 'Uncharted mission',
      status: unreadIds.has(thread.id) ? 'unread' : 'charted',
      unread: unreadIds.has(thread.id),
      threadId: thread.id,
      missionId: mission?.id,
      agentId: agent?.id,
    });
    routeIds.push(...(agent ? [agent.id] : []), thread.id);
    overviewNodeIds.push(thread.id);
    if (agent) {
      connections.push({
        id: `route:${thread.id}:${agent.id}:${thread.id}`,
        source: agent.id,
        target: thread.id,
        kind: 'attachment',
        threadId: thread.id,
      });
    }

    const messages = messagesOf(graph, thread);
    let previousId = thread.id;
    messages.forEach((message, order) => {
      const t = 0.24 + ((order + 1) / (messages.length + 1)) * 0.61;
      const routePoint = cubicPoint(curve, t);
      const normal = cubicNormal(curve, t);
      const offset = (order % 2 === 0 ? -1 : 1) * 34;
      const point = { x: routePoint.x + normal.x * offset, y: routePoint.y + normal.y * offset };
      const mine = field(message, 'senderId') === 'principal_chris';
      landmarks.push({
        id: message.id,
        record: message,
        variant: 'message',
        position: { x: point.x - 112, y: point.y - 42 },
        width: 224,
        height: 84,
        threadId: thread.id,
        missionId: mission?.id,
        agentId: agent?.id,
        body: field(message, 'body'),
        meta: `${mine ? 'You' : agent?.title ?? 'Agent'} · ${clock(field(message, 'createdAt'))}`,
        mine,
        sequence: order + 1,
      });
      connections.push({
        id: `route:${thread.id}:${previousId}:${message.id}`,
        source: previousId,
        target: message.id,
        kind: 'chronology',
        threadId: thread.id,
        order,
      });
      routeIds.push(message.id);
      previousId = message.id;

      graph.relatedBy(message.id, 'references').forEach((reference, referenceIndex) => {
        if (claimedReferences.has(reference.id)) {
          connections.push({
            id: `reference:${message.id}:${reference.id}`,
            source: message.id,
            target: reference.id,
            kind: 'reference',
            threadId: thread.id,
          });
          return;
        }
        claimedReferences.add(reference.id);
        const distance = 190 + referenceIndex * 46;
        const branchSide = order % 2 === 0 ? 1 : -1;
        const cairnCenter = {
          x: routePoint.x + normal.x * distance * branchSide,
          y: routePoint.y + normal.y * distance * branchSide,
        };
        landmarks.push({
          id: reference.id,
          record: reference,
          variant: 'reference',
          position: { x: cairnCenter.x - 78, y: cairnCenter.y - 38 },
          width: 156,
          height: 76,
          threadId: thread.id,
          missionId: mission?.id,
          subtitle: reference.kind,
          status: field(reference, 'status'),
        });
        connections.push({
          id: `reference:${message.id}:${reference.id}`,
          source: message.id,
          target: reference.id,
          kind: 'reference',
          threadId: thread.id,
        });
        routeIds.push(reference.id);
      });
    });

    if (mission) {
      connections.push({
        id: `route:${thread.id}:${previousId}:${mission.id}`,
        source: previousId,
        target: mission.id,
        kind: 'attachment',
        threadId: thread.id,
        order: messages.length,
      });
      routeIds.push(mission.id);
    }
    nodeIdsByThread.set(thread.id, Array.from(new Set(routeIds)));
  }

  return {
    landmarks,
    connections,
    missionFields,
    nodeIdsByThread,
    overviewNodeIds: Array.from(new Set(overviewNodeIds)),
  };
}
