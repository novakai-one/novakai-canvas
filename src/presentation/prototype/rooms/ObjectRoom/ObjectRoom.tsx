/**
 * Two smaller Rooms that share one reading layout: a Project and an Agent.
 *
 * Both answer the same shape of question — what does this object own, and what is it
 * connected to — so they share one design seam rather than each growing their own.
 */
import { useStore } from '../../app/store';
import { roomFor } from '../../room-navigation/room-for';
import { subjectProjection } from './object-room-data';
import type { ObjectRoomDesignCommands, ObjectRoomDesignData } from './object-room-design';
import { resolveObjectRoomDesign } from './object-room-design-registry';

/** Composition root that supplies one subject's state and host commands to a design. */
function ObjectRoom({ subjectId }: { subjectId: string }) {
  const { graph, selected, elected, select, enterRoom } = useStore();
  const design = resolveObjectRoomDesign(typeof window === 'undefined' ? '' : window.location.search);
  const DesignView = design.View;

  const subject = graph.get(subjectId);
  if (!subject) return null;

  const data: ObjectRoomDesignData = {
    graph,
    subject,
    ...subjectProjection(graph, subject),
    selected,
    attentionSubjectId: elected?.subject.id ?? null,
  };

  const commands: ObjectRoomDesignCommands = {
    select: (record) => select(record?.id ?? null),
    open: (record) => {
      const room = roomFor(record);
      if (room) enterRoom(room);
    },
  };

  return <DesignView data={data} commands={commands} />;
}

export function ProjectRoom({ projectId }: { projectId: string }) {
  return <ObjectRoom subjectId={projectId} />;
}

export function AgentRoom({ agentId }: { agentId: string }) {
  return <ObjectRoom subjectId={agentId} />;
}
