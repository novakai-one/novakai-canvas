import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignProps } from '../../messages-design';
import { CatenaryCanvas } from './CatenaryCanvas';
import { CatenaryComposer } from './CatenaryComposer';
import { NewCablePicker } from './NewCablePicker';
import { buildCatenaryModel } from './catenary-model';
import './messages-catenary.css';

/** How long the released cable keeps its settled colour before going quiet. */
const RELEASE_HOLD_MS = 1100;

function WaitingCount({ waiting }: { waiting: number }) {
  return (
    <div className="catenary__status">
      <span>Messages</span>
      <strong>{waiting === 0 ? 'nothing waiting' : `${waiting} waiting`}</strong>
    </div>
  );
}

function EmptyBundle() {
  return (
    <div className="catenary__empty">
      <strong>No cables yet</strong>
      <p>Start a conversation with an Agent and it appears here, slack.</p>
    </div>
  );
}

/** Renders the Catenary bundle through the public Messages design contract. */
export function MessagesCatenary({ data, commands }: MessagesDesignProps) {
  const model = useMemo(
    () => buildCatenaryModel(data.graph, data.threads, data.liveAgents, data.attentionSubjectId),
    [data.attentionSubjectId, data.graph, data.liveAgents, data.threads],
  );

  const [focusedCableId, setFocusedCableId] = useState(
    data.initialThreadId ?? model.entryCableId ?? '',
  );
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null);
  const [releasedCableId, setReleasedCableId] = useState<string | null>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const focusedCable = model.cables.find((cable) => cable.record.id === focusedCableId)
    ?? model.cables[0]
    ?? null;

  useEffect(() => {
    if (data.initialThreadId) setFocusedCableId(data.initialThreadId);
  }, [data.initialThreadId]);

  useEffect(() => {
    if (!data.selected) setSourceNodeId(null);
  }, [data.selected]);

  useEffect(() => () => clearTimeout(releaseTimer.current), []);

  const closeInspector = useCallback(() => {
    setSourceNodeId(null);
    commands.select(null);
  }, [commands]);

  const chooseCable = useCallback((cableId: string) => {
    setFocusedCableId(cableId);
    closeInspector();
  }, [closeInspector]);

  const selectBead = useCallback((record: ObjectRecord, nodeId: string) => {
    setSourceNodeId(nodeId);
    commands.select(record);
  }, [commands]);

  const startConversation = useCallback((agent: ObjectRecord) => {
    chooseCable(commands.startConversation(agent));
  }, [chooseCable, commands]);

  const send = useCallback((body: string) => {
    if (!focusedCable) return;
    const releasedId = focusedCable.record.id;
    commands.send(releasedId, body);
    setReleasedCableId(releasedId);
    clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => setReleasedCableId(null), RELEASE_HOLD_MS);
  }, [commands, focusedCable]);

  return (
    <div className="messages-catenary" data-inspector={Boolean(data.selected)}>
      <WaitingCount waiting={model.waitingCount} />
      {focusedCable ? (
        <CatenaryCanvas
          model={model}
          graph={data.graph}
          focusedCable={focusedCable}
          selected={data.selected}
          sourceNodeId={sourceNodeId}
          releasedCableId={releasedCableId}
          commands={commands}
          onChooseCable={chooseCable}
          onSelectBead={selectBead}
          onCloseInspector={closeInspector}
        />
      ) : <EmptyBundle />}
      <div className="catenary__controls">
        <NewCablePicker agents={model.agents} onStartConversation={startConversation} />
        <CatenaryComposer cable={focusedCable} onSend={send} />
      </div>
    </div>
  );
}
