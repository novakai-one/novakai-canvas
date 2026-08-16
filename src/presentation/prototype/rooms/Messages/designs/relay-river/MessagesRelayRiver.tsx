import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignProps } from '../../messages-design';
import { RelayRiverCanvas } from './RelayRiverCanvas';
import { RiverComposer } from './RiverComposer';
import { RiverConversationRail } from './RiverConversationRail';
import { buildRelayRiverModel, type RiverThread } from './relay-river-model';
import './messages-relay-river.css';

function RiverStageHeader({ thread }: { thread: RiverThread | null }) {
  if (!thread) {
    return (
      <header className="relay-river__stage-header">
        <div><span>Messages</span><h1>Relay River</h1></div>
        <p>Choose an Agent to start the first current.</p>
      </header>
    );
  }
  return (
    <header className="relay-river__stage-header">
      <div>
        <span>Active current · {thread.agentRole}</span>
        <h1>{thread.agent?.title ?? 'Conversation'}</h1>
      </div>
      <div className="relay-river__stage-context">
        <span>Mission headwater</span>
        <strong>{thread.mission?.title ?? 'No Mission attached'}</strong>
      </div>
      <div className="relay-river__stage-now" data-unresolved={thread.now?.unresolved ?? false}>
        <span>Now</span>
        <strong>{thread.now ? (thread.now.unresolved ? 'Needs your reply' : 'Latest turn') : 'Ready to begin'}</strong>
      </div>
    </header>
  );
}

function EmptyRiver() {
  return (
    <div className="relay-river__empty">
      <span>Messages</span>
      <strong>No currents yet.</strong>
      <p>Choose New, then select an Agent. Their Mission context will arrive with them.</p>
    </div>
  );
}

/** Renders the calibrated Relay River through the public Messages design contract. */
export function MessagesRelayRiver({ data, commands }: MessagesDesignProps) {
  const model = useMemo(() => buildRelayRiverModel(
    data.graph,
    data.threads,
    data.liveAgents,
    data.attentionSubjectId,
  ), [data.attentionSubjectId, data.graph, data.liveAgents, data.threads]);
  const [activeThreadId, setActiveThreadId] = useState(
    data.initialThreadId ?? model.entryThreadId ?? '',
  );
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null);
  const activeThread = model.threads.find((thread) => thread.record.id === activeThreadId)
    ?? model.threads[0]
    ?? null;

  useEffect(() => {
    if (data.initialThreadId) setActiveThreadId(data.initialThreadId);
  }, [data.initialThreadId]);
  useEffect(() => {
    if (!data.selected) setSourceNodeId(null);
  }, [data.selected]);

  const closeInspector = useCallback(() => {
    setSourceNodeId(null);
    commands.select(null);
  }, [commands]);
  const chooseThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    closeInspector();
  }, [closeInspector]);
  const selectSource = useCallback((record: ObjectRecord, nodeId: string) => {
    setSourceNodeId(nodeId);
    commands.select(record);
  }, [commands]);
  const startConversation = useCallback((agent: ObjectRecord) => {
    const threadId = commands.startConversation(agent);
    setActiveThreadId(threadId);
    closeInspector();
  }, [closeInspector, commands]);

  return (
    <div className="relay-river" data-inspector={Boolean(data.selected)}>
      <RiverConversationRail
        model={model}
        activeThreadId={activeThread?.record.id ?? ''}
        onChooseThread={chooseThread}
        onStartConversation={startConversation}
      />
      <main className="relay-river__stage">
        <RiverStageHeader thread={activeThread} />
        {activeThread ? (
          <RelayRiverCanvas
            model={model}
            graph={data.graph}
            activeThread={activeThread}
            selected={data.selected}
            sourceNodeId={sourceNodeId}
            commands={commands}
            onChooseThread={chooseThread}
            onSelectSource={selectSource}
            onCloseInspector={closeInspector}
          />
        ) : <EmptyRiver />}
        <RiverComposer
          thread={activeThread}
          onSend={(body) => {
            if (activeThread) commands.send(activeThread.record.id, body);
          }}
        />
      </main>
    </div>
  );
}
