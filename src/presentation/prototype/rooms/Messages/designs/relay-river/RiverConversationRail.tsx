import { useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import type { RelayRiverModel, RiverThread } from './relay-river-model';

function initials(title: string): string {
  return title
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function latestPreview(thread: RiverThread): string {
  const latest = thread.messages.at(-1)?.record;
  return latest ? field(latest, 'body') || latest.title : 'No messages yet';
}

function ThreadButton({
  thread,
  active,
  onChoose,
}: {
  thread: RiverThread;
  active: boolean;
  onChoose: () => void;
}) {
  const agentName = thread.agent?.title ?? 'Conversation';
  return (
    <button
      type="button"
      className="river-rail__thread"
      data-active={active}
      data-unread={thread.unread}
      onClick={onChoose}
    >
      <span className="river-rail__avatar">{initials(agentName)}</span>
      <span className="river-rail__thread-copy">
        <strong>{agentName}</strong>
        <small>{thread.mission?.title ?? 'No Mission attached'}</small>
        <span>{latestPreview(thread)}</span>
      </span>
    </button>
  );
}

function AgentPicker({
  agents,
  onStart,
}: {
  agents: RelayRiverModel['agents'];
  onStart: (agent: ObjectRecord) => void;
}) {
  return (
    <div className="river-rail__agents">
      <p>Choose an Agent</p>
      {agents.map(({ record, role }) => (
        <button type="button" key={record.id} onClick={() => onStart(record)}>
          <span className="river-rail__avatar">{initials(record.title)}</span>
          <span><strong>{record.title}</strong><small>{role}</small></span>
        </button>
      ))}
    </div>
  );
}

/** Presents recent tributaries and the existing new-conversation command. */
export function RiverConversationRail({
  model,
  activeThreadId,
  onChooseThread,
  onStartConversation,
}: {
  model: RelayRiverModel;
  activeThreadId: string;
  onChooseThread: (threadId: string) => void;
  onStartConversation: (agent: ObjectRecord) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <aside className="river-rail" aria-label="Recent conversations">
      <header className="river-rail__header">
        <div><span>Messages</span><strong>Tributaries</strong></div>
        <button type="button" onClick={() => setPickerOpen((open) => !open)}>
          {pickerOpen ? 'Close' : 'New'}
        </button>
      </header>
      {pickerOpen && (
        <AgentPicker
          agents={model.agents}
          onStart={(agent) => {
            onStartConversation(agent);
            setPickerOpen(false);
          }}
        />
      )}
      <div className="river-rail__threads">
        {model.threads.map((thread) => (
          <ThreadButton
            key={thread.record.id}
            thread={thread}
            active={thread.record.id === activeThreadId}
            onChoose={() => onChooseThread(thread.record.id)}
          />
        ))}
      </div>
    </aside>
  );
}
