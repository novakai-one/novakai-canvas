import { useCallback } from 'react';
import { makeRecord, sessionId, useStore } from '../../app/store';
import { field } from '../../object-graph/graph';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import { roomFor } from '../../room-navigation/room-for';
import type {
  AnswerDecisionRequestInput,
  MessagesDesignCommands,
  MessagesDesignData,
} from './messages-design';
import { resolveMessagesDesign } from './messages-design-registry';

/** Composition root: translates the app store into the stable Messages design contract. */
export function Messages({ threadId }: { threadId?: string }) {
  const {
    graph,
    select,
    selected,
    elected,
    addRecord,
    enterRoom,
    patch,
    replaceRefs,
  } = useStore();
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

  const markThreadRead = useCallback((activeThreadId: string) => {
    for (const notification of graph.byKind('notification')) {
      const subject = notification.fields.subjectRef as { id?: unknown } | undefined;
      if (subject?.id === activeThreadId && field(notification, 'status') === 'unread') {
        patch(notification.id, { status: 'read' });
      }
    }
  }, [graph, patch]);

  const archiveThread = useCallback((activeThreadId: string) => {
    patch(activeThreadId, { archived: true });
  }, [patch]);

  const attachThreadToMission = useCallback((activeThreadId: string, missionId: string) => {
    const thread = graph.get(activeThreadId);
    const mission = graph.get(missionId);
    if (!thread || thread.kind !== 'thread' || !mission || mission.kind !== 'mission') return;
    replaceRefs(activeThreadId, [
      ...thread.refs.filter((ref) => ref.kind !== 'mission'),
      { kind: 'mission', value: missionId },
    ]);
    patch(activeThreadId, { roomId: missionId });
  }, [graph, patch, replaceRefs]);

  const answerDecisionRequest = useCallback(({
    requestId,
    ruling,
  }: AnswerDecisionRequestInput): ObjectId => {
    const request = graph.get(requestId);
    if (!request || request.kind !== 'request') {
      throw new Error(`Cannot answer missing Decision Request: ${requestId}`);
    }

    const trimmedRuling = ruling.trim();
    if (!trimmedRuling) throw new Error('A Decision ruling cannot be empty.');

    const existingDecisionId = field(request, 'decision');
    const existingDecision = existingDecisionId ? graph.get(existingDecisionId) : undefined;
    if (existingDecision?.kind === 'decision') return existingDecision.id;

    const timestamp = new Date().toISOString();
    const decisionId = sessionId('decision', trimmedRuling);
    const decision = makeRecord(
      decisionId,
      'decision',
      trimmedRuling,
      {
        ts: timestamp,
        body: trimmedRuling,
        principalId: 'principal_chris',
      },
      [{ kind: 'request', value: requestId }],
    );
    addRecord({ ...decision, createdAt: timestamp });
    patch(requestId, {
      status: 'answered',
      answer: trimmedRuling,
      decision: decisionId,
      updated: timestamp,
    });
    for (const notification of graph.byKind('notification')) {
      const subject = notification.fields.subjectRef as { id?: unknown } | undefined;
      if (subject?.id === requestId) patch(notification.id, { status: 'read' });
    }
    return decisionId;
  }, [addRecord, graph, patch]);

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
    markThreadRead,
    archiveThread,
    attachThreadToMission,
    answerDecisionRequest,
  };

  return <DesignView data={data} commands={commands} />;
}
