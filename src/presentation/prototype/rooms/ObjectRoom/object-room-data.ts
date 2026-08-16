/**
 * The per-kind projections behind the shared Object Room seam.
 *
 * A Project and an Agent answer the same shape of question — what does this object
 * own, and what is it connected to — so both are normalised here into identity facts
 * plus sections, and designs never walk the graph per kind themselves.
 */
import { field } from '../../object-graph/graph';
import type { ObjectGraph } from '../../object-graph/graph';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import { roomFor } from '../../room-navigation/room-for';
import type { IdentityFact, ObjectRoomSection } from './object-room-design';

type SubjectProjection = {
  identity: readonly IdentityFact[];
  sections: readonly ObjectRoomSection[];
  openableIds: ReadonlySet<ObjectId>;
};

function openableIdsIn(sections: readonly ObjectRoomSection[]): ReadonlySet<ObjectId> {
  const ids = new Set<ObjectId>();
  for (const section of sections) {
    for (const record of section.records) {
      if (roomFor(record)) ids.add(record.id);
    }
  }
  return ids;
}

function projectProjection(graph: ObjectGraph, project: ObjectRecord): SubjectProjection {
  const identity: IdentityFact[] = [
    { label: 'Focus', value: field(project, 'focus'), renderAs: 'text' },
    { label: 'Path', value: field(project, 'path'), renderAs: 'mono' },
  ];
  const sections: ObjectRoomSection[] = [
    {
      label: 'Missions in this project',
      records: graph.relatedOfKind(project.id, 'contains', 'mission'),
      emptyMessage: 'No missions are attached to this project yet.',
    },
  ];
  return { identity, sections, openableIds: openableIdsIn(sections) };
}

function agentProjection(graph: ObjectGraph, agent: ObjectRecord): SubjectProjection {
  const seat = graph.relatedBy(agent.id, 'occupies')[0];
  const role = seat ? graph.relatedBy(seat.id, 'requests')[0] : undefined;

  const identity: IdentityFact[] = [
    { label: 'Provider', value: field(agent, 'provider'), renderAs: 'text' },
    { label: 'Presence', value: field(agent, 'status'), renderAs: 'status' },
    { label: 'Session', value: field(agent, 'sessionId') || 'none', renderAs: 'mono' },
    { label: 'Role in seat', value: role?.title ?? 'Unseated', renderAs: 'text' },
  ];
  const sections: ObjectRoomSection[] = [
    {
      label: 'Mission',
      records: graph.relatedBy(agent.id, 'belongsTo').filter((r) => r.kind === 'mission'),
    },
    { label: 'Assigned work', records: graph.relatedBy(agent.id, 'assigned') },
    { label: 'Runs', records: graph.relatedOfKind(agent.id, 'contains', 'agentRun') },
    { label: 'Conversations', records: graph.relatedBy(agent.id, 'discussedIn') },
  ];
  return { identity, sections, openableIds: openableIdsIn(sections) };
}

/** Normalises any supported subject kind into the one shape designs render. */
export function subjectProjection(graph: ObjectGraph, subject: ObjectRecord): SubjectProjection {
  return subject.kind === 'project'
    ? projectProjection(graph, subject)
    : agentProjection(graph, subject);
}
