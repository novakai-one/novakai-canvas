import { useCallback } from 'react';
import { makeRecord, sessionId, useStore } from '../../app/store';
import { field } from '../../object-graph/graph';
import type { ObjectRecord } from '../../object-graph/contract';
import { roomFor } from '../../room-navigation/room-for';
import type { MessagesDesignCommands, MessagesDesignData } from './messages-design';
import { resolveMessagesDesign } from './messages-design-registry';

/** Composition root: translates the app store into the stable Messages design contract. */
export function Messages({ threadId }: { threadId?: string }) {
  const { graph, select, selected, elected, addRecord, enterRoom, patch } = useStore();
  const design = resolveMessagesDesign(typeof window === 'undefined' ? '' : window.location.search);
  const DesignView = design.View;

  const send = useCallback((activeThreadId: string, body: string) => {
    const id = sessionId('msg', body.slice(0, 20));
    addRecord(
      makeRecord(id, 'message', body, {
        messageId: id,
        threadId: activeThreadId,
        senderId: 'principal_chris',
        body,
        createdAt: new Date().toISOString(),
      }),
    );

    const notification = graph
      .byKind('notification')
      .find((record) => (record.fields.subjectRef as { id?: string })?.id === activeThreadId);
    if (notification) patch(notification.id, { status: 'read' });
  }, [addRecord, graph, patch]);

  const startConversation = useCallback((agent: ObjectRecord): string => {
    const mission = graph.relatedBy(agent.id, 'belongsTo').find((record) => record.kind === 'mission');
    const id = sessionId('thread', agent.title);
    addRecord(
      makeRecord(
        id,
        'thread',
        `Conversation with ${agent.title}`,
        { roomId: mission?.id ?? '', ts: new Date().toISOString() },
        [
          ...(mission ? [{ kind: 'mission', value: mission.id }] : []),
          { kind: 'agent', value: agent.id },
        ],
      ),
    );
    return id;
  }, [addRecord, graph]);

  const data: MessagesDesignData = {
    graph,
    threads: graph.byKind('thread'),
    liveAgents: graph.byKind('agent').filter((agent) => field(agent, 'status') === 'live'),
    selected,
    attentionSubjectId: elected?.subject.id ?? null,
    initialThreadId: threadId,
  };

  const commands: MessagesDesignCommands = {
    select: (record) => select(record?.id ?? null),
    canOpen: (record) => roomFor(record) !== null,
    open: (record) => {
      const room = roomFor(record);
      if (room) enterRoom(room);
    },
    send,
    startConversation,
  };

  return <DesignView data={data} commands={commands} />;
}
