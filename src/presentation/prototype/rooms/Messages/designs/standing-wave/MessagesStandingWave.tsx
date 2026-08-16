/**
 * Standing Wave: every conversation in the Room measured against one shared clock.
 *
 * The design root does three things and no more — it reads the graph once, remembers
 * which conversation is open and which moment is selected, and hands both to the canvas.
 * All host state still belongs to the host: selection travels through `commands.select`,
 * never through local state pretending to own it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignProps } from '../../messages-design';
import { buildWaveClock } from './standing-wave-clock';
import { buildStandingWaveModel, type WaveAgent } from './standing-wave-model';
import { StandingWaveCanvas } from './StandingWaveCanvas';
import './messages-standing-wave.css';

function EmptyRoom() {
  return (
    <div className="standing-wave__empty">
      <span>Messages</span>
      <strong>No traffic on the clock yet.</strong>
    </div>
  );
}

/** Renders Standing Wave through the public Messages design contract. */
export function MessagesStandingWave({ data, commands }: MessagesDesignProps) {
  const model = useMemo(
    () => buildStandingWaveModel(
      data.graph,
      data.threads,
      data.liveAgents,
      data.attentionSubjectId,
    ),
    [data.attentionSubjectId, data.graph, data.liveAgents, data.threads],
  );

  const clock = useMemo(
    () => buildWaveClock(model.traces.flatMap((trace) => trace.messages.map((m) => m.time))),
    [model.traces],
  );

  const [activeThreadId, setActiveThreadId] = useState(
    data.initialThreadId ?? model.entryThreadId ?? '',
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeTrace = model.traces.find((trace) => trace.record.id === activeThreadId)
    ?? model.traces[0]
    ?? null;

  useEffect(() => {
    if (data.initialThreadId) setActiveThreadId(data.initialThreadId);
  }, [data.initialThreadId]);
  useEffect(() => {
    if (!data.selected) setSelectedNodeId(null);
  }, [data.selected]);

  const closeInspector = useCallback(() => {
    setSelectedNodeId(null);
    commands.select(null);
  }, [commands]);

  const chooseThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    closeInspector();
  }, [closeInspector]);

  const selectNode = useCallback((record: ObjectRecord, nodeId: string) => {
    setSelectedNodeId(nodeId);
    commands.select(record);
  }, [commands]);

  const chooseAgent = useCallback((agent: WaveAgent) => {
    const threadId = agent.threadId ?? commands.startConversation(agent.record);
    chooseThread(threadId);
  }, [chooseThread, commands]);

  if (model.traces.length === 0) return <EmptyRoom />;

  return (
    <div className="standing-wave" data-inspector={Boolean(data.selected)}>
      <StandingWaveCanvas
        model={model}
        clock={clock}
        graph={data.graph}
        activeTrace={activeTrace}
        selected={data.selected}
        selectedNodeId={selectedNodeId}
        commands={commands}
        onChooseThread={chooseThread}
        onChooseAgent={chooseAgent}
        onSelectNode={selectNode}
        onCloseInspector={closeInspector}
      />
    </div>
  );
}
