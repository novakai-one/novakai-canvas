import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignCommands, MessagesDesignData, MessagesDesignProps } from '../../messages-design';
import { OrreryConversationControls } from './OrreryConversationControls';
import { SignalLensInspector } from './SignalLensInspector';
import { SignalOrreryScene } from './SignalOrreryScene';
import { buildSignalOrreryModel, type OrreryConversation } from './signal-orrery-model';
import './signal-orrery.css';

function OrreryHeader({ conversation }: { conversation: OrreryConversation | null }) {
  return (
    <header className="signal-orrery__header">
      <div>
        <span>Messages / Orbital correspondence</span>
        <h1>{conversation?.agent?.title ?? 'Signal Orrery'}</h1>
        <p>{conversation ? `${conversation.messages.length} turns · ${conversation.agentRole}` : 'Choose an Agent conversation'}</p>
      </div>
      {conversation?.mission && (
        <div className="signal-orrery__mission-context">
          <span>Mission context</span>
          <strong>{conversation.mission.title}</strong>
        </div>
      )}
    </header>
  );
}

function useOrreryCommands({
  commands,
  resolvedThreadId,
  draft,
  setActiveThreadId,
  setOverview,
  setPickerOpen,
  setDraft,
}: {
  commands: MessagesDesignCommands;
  resolvedThreadId: string | null;
  draft: string;
  setActiveThreadId: (id: string) => void;
  setOverview: (overview: boolean | ((current: boolean) => boolean)) => void;
  setPickerOpen: (open: boolean) => void;
  setDraft: (draft: string) => void;
}) {
  const closeInspector = useCallback(() => commands.select(null), [commands]);
  const chooseThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    setOverview(false);
    closeInspector();
  }, [closeInspector, setActiveThreadId, setOverview]);
  const chooseAgent = useCallback((agent: ObjectRecord) => {
    const threadId = commands.startConversation(agent);
    setActiveThreadId(threadId);
    setOverview(false);
    setPickerOpen(false);
    closeInspector();
  }, [closeInspector, commands, setActiveThreadId, setOverview, setPickerOpen]);
  const send = useCallback(() => {
    if (!resolvedThreadId || !draft.trim()) return;
    commands.send(resolvedThreadId, draft.trim());
    setDraft('');
  }, [commands, draft, resolvedThreadId, setDraft]);
  const toggleOverview = useCallback(() => {
    setOverview((value) => !value);
    closeInspector();
  }, [closeInspector, setOverview]);
  return { closeInspector, chooseThread, chooseAgent, send, toggleOverview };
}

type SignalOrreryLayoutProps = {
  data: MessagesDesignData;
  commands: MessagesDesignCommands;
  model: ReturnType<typeof buildSignalOrreryModel>;
  activeConversation: OrreryConversation | null;
  resolvedThreadId: string | null;
  overview: boolean;
  pickerOpen: boolean;
  draft: string;
  actions: ReturnType<typeof useOrreryCommands>;
  setDraft: (draft: string) => void;
  togglePicker: () => void;
};

function SignalOrreryLayout({
  data, commands, model, activeConversation, resolvedThreadId,
  overview, pickerOpen, draft, actions, setDraft, togglePicker,
}: SignalOrreryLayoutProps) {
  return (
    <div className="signal-orrery" data-inspector={Boolean(data.selected)} data-overview={overview}>
      <OrreryHeader conversation={activeConversation} />
      <main className="signal-orrery__stage">
        <SignalOrreryScene
          model={model}
          graph={data.graph}
          activeThreadId={resolvedThreadId}
          selected={data.selected}
          overview={overview}
          onChooseThread={actions.chooseThread}
          onSelectRecord={commands.select}
        />
      </main>
      <OrreryConversationControls
        activeConversation={activeConversation}
        agents={data.liveAgents}
        draft={draft}
        pickerOpen={pickerOpen}
        overview={overview}
        onDraftChange={setDraft}
        onSend={actions.send}
        onChooseAgent={actions.chooseAgent}
        onTogglePicker={togglePicker}
        onOverview={actions.toggleOverview}
      />
      {data.selected && (
        <SignalLensInspector
          graph={data.graph}
          selected={data.selected}
          commands={commands}
          onClose={actions.closeInspector}
        />
      )}
    </div>
  );
}

/** Renders Signal Orrery entirely through the stable Messages design contract. */
export function MessagesSignalOrrery({ data, commands }: MessagesDesignProps) {
  const model = useMemo(() => buildSignalOrreryModel({
    graph: data.graph,
    threads: data.threads,
    attentionSubjectId: data.attentionSubjectId,
    initialThreadId: data.initialThreadId,
  }), [data.attentionSubjectId, data.graph, data.initialThreadId, data.threads]);
  const [activeThreadId, setActiveThreadId] = useState(data.initialThreadId ?? model.entryThreadId);
  const [overview, setOverview] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const resolvedThreadId = model.conversations.some(({ record }) => record.id === activeThreadId)
    ? activeThreadId
    : model.entryThreadId;
  const activeConversation = model.conversations.find(({ record }) => record.id === resolvedThreadId) ?? null;
  const actions = useOrreryCommands({
    commands, resolvedThreadId, draft, setActiveThreadId, setOverview, setPickerOpen, setDraft,
  });

  useEffect(() => {
    if (!data.initialThreadId) return;
    setActiveThreadId(data.initialThreadId);
    setOverview(false);
  }, [data.initialThreadId]);

  return <SignalOrreryLayout
    data={data}
    commands={commands}
    model={model}
    activeConversation={activeConversation}
    resolvedThreadId={resolvedThreadId}
    overview={overview}
    pickerOpen={pickerOpen}
    draft={draft}
    actions={actions}
    setDraft={setDraft}
    togglePicker={() => setPickerOpen((value) => !value)}
  />;
}
