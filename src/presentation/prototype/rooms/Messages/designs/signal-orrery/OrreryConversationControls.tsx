import type { FormEvent, KeyboardEvent } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { OrreryConversation } from './signal-orrery-model';

function AgentPicker({
  agents,
  onChoose,
  onClose,
}: {
  agents: readonly ObjectRecord[];
  onChoose: (agent: ObjectRecord) => void;
  onClose: () => void;
}) {
  return (
    <aside className="orrery-controls__picker" aria-label="Start an Agent conversation">
      <header><span>Open a new orbit</span><button type="button" onClick={onClose}>×</button></header>
      <p>Choose a live Agent. The conversation stands on its own.</p>
      <div>
        {agents.map((agent) => (
          <button type="button" key={agent.id} onClick={() => onChoose(agent)}>
            <span>{agent.title.slice(0, 2).toUpperCase()}</span>
            <strong>{agent.title}<small>Live Agent</small></strong>
            <em>Start →</em>
          </button>
        ))}
      </div>
    </aside>
  );
}

function Composer({
  activeConversation,
  draft,
  onDraftChange,
  onSend,
}: {
  activeConversation: OrreryConversation | null;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSend();
  };
  const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    onSend();
  };

  return (
    <form className="orrery-controls__composer" onSubmit={submit} data-disabled={!activeConversation}>
      <span className="orrery-controls__now"><i />Now</span>
      <textarea
        value={draft}
        rows={1}
        disabled={!activeConversation}
        placeholder={activeConversation ? `Message ${activeConversation.agent?.title ?? 'this conversation'}…` : 'Choose a conversation'}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={sendOnEnter}
      />
      <button type="submit" disabled={!activeConversation || !draft.trim()}>Send <span>↗</span></button>
    </form>
  );
}

/** Renders overview, new-conversation and fixed-now composition controls. */
export function OrreryConversationControls({
  activeConversation,
  agents,
  draft,
  pickerOpen,
  overview,
  onDraftChange,
  onSend,
  onChooseAgent,
  onTogglePicker,
  onOverview,
}: {
  activeConversation: OrreryConversation | null;
  agents: readonly ObjectRecord[];
  draft: string;
  pickerOpen: boolean;
  overview: boolean;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  onChooseAgent: (agent: ObjectRecord) => void;
  onTogglePicker: () => void;
  onOverview: () => void;
}) {
  return (
    <div className="orrery-controls">
      <div className="orrery-controls__actions">
        <button type="button" onClick={onOverview}>{overview ? 'Return to focus' : 'Overview'}</button>
        <button type="button" className="orrery-controls__new" onClick={onTogglePicker}>
          {pickerOpen ? 'Close' : '+ New conversation'}
        </button>
      </div>
      {pickerOpen && <AgentPicker agents={agents} onChoose={onChooseAgent} onClose={onTogglePicker} />}
      {!overview && (
        <Composer
          activeConversation={activeConversation}
          draft={draft}
          onDraftChange={onDraftChange}
          onSend={onSend}
        />
      )}
    </div>
  );
}
