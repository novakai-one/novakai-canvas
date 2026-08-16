/**
 * The Messages Room as a turn boundary you can stand in front of.
 *
 * One seam splits the field: conversations resting on the left are waiting on you,
 * conversations on the right are waiting on an agent, and how far out a block sits is
 * how long it has been that way. Answering the one lit block moves it across the seam
 * in front of you, which is the whole point — the room shows you the state of your
 * obligations, and acting on them visibly changes the shape of the room.
 *
 * This module owns every interaction. The Messages design contract stays the only seam
 * to the host for selection, navigation and writes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './messages-turn-line.css';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { EmptyState } from '../../../../components/ui/ui';
import type { MessagesDesignProps } from '../../messages-design';
import { alsoDiscussedIn, buildTurnLineModel } from './turn-line-model';
import { layoutField, type FieldSize } from './turn-line-geometry';
import { TurnLineField } from './TurnLineField';
import { AgentDock } from './AgentDock';
import { TurnLineTether } from './TurnLineTether';
import { SeamReader, type BloomTarget } from './SeamReader';
import type { MarkerTone } from './TurnLineMarker';

function clockOf(epoch: number): string {
  return epoch > 0 ? new Date(epoch).toISOString().slice(11, 16) : '';
}

export function MessagesTurnLine({ data, commands }: MessagesDesignProps) {
  const { graph, liveAgents, attentionSubjectId, initialThreadId } = data;

  const [openThreadId, setOpenThreadId] = useState<string | null>(initialThreadId ?? null);
  const [bloom, setBloom] = useState<BloomTarget | null>(null);
  const [releasedThreadIds, setReleasedThreadIds] = useState<readonly string[]>([]);
  const [dockOpen, setDockOpen] = useState(false);
  const [size, setSize] = useState<FieldSize>({ width: 0, height: 0 });
  const fieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = fieldRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const model = useMemo(
    () => buildTurnLineModel(graph, liveAgents, attentionSubjectId),
    [attentionSubjectId, graph, liveAgents],
  );

  const layout = useMemo(
    () => layoutField(model.threads, model.maxWaitMs, size),
    [model.maxWaitMs, model.threads, size],
  );

  const openEntry = model.threads.find((entry) => entry.id === openThreadId) ?? null;
  const amberHeld =
    model.amberThreadId !== null && !releasedThreadIds.includes(model.amberThreadId);

  const toneFor = useCallback(
    (threadId: string): MarkerTone => {
      if (threadId !== model.amberThreadId) return 'quiet';
      return releasedThreadIds.includes(threadId) ? 'settled' : 'amber';
    },
    [model.amberThreadId, releasedThreadIds],
  );

  const selectThread = useCallback(
    (threadId: string) => {
      const entry = model.threads.find((candidate) => candidate.id === threadId);
      if (!entry) return;
      setOpenThreadId(threadId);
      setBloom(null);
      setDockOpen(false);
      commands.select(entry.thread);
    },
    [commands, model.threads],
  );

  // Revealing a referenced object is selection, not navigation: context comes first.
  const revealRecord = useCallback(
    (messageId: string, record: ObjectRecord) => {
      setBloom((current) =>
        current?.messageId === messageId && current.record.id === record.id
          ? null
          : { messageId, record },
      );
      commands.select(record);
    },
    [commands],
  );

  const openRecord = useCallback(
    (record: ObjectRecord) => {
      if (commands.canOpen(record)) commands.open(record);
    },
    [commands],
  );

  const send = useCallback(
    (body: string) => {
      if (!openEntry) return;
      commands.send(openEntry.id, body);
      // Answering the elected subject releases the gold: the block settles to sage.
      if (openEntry.id === model.amberThreadId) {
        setReleasedThreadIds((current) =>
          current.includes(openEntry.id) ? current : [...current, openEntry.id],
        );
      }
    },
    [commands, model.amberThreadId, openEntry],
  );

  const pickAgent = useCallback(
    (agent: ObjectRecord) => {
      const threadId = commands.startConversation(agent);
      setDockOpen(false);
      setOpenThreadId(threadId);
      setBloom(null);
    },
    [commands],
  );

  const alsoInCount = useMemo(() => {
    if (!bloom || !openEntry) return 0;
    return alsoDiscussedIn(graph, bloom.record.id, openEntry.id).length;
  }, [bloom, graph, openEntry]);

  if (model.threads.length === 0 && !dockOpen) {
    return (
      <div className="turn-line turn-line--empty">
        <EmptyState>No conversation is open. Start one with an agent.</EmptyState>
        <button type="button" className="tl-field__start" onClick={() => setDockOpen(true)}>
          Start a conversation
        </button>
      </div>
    );
  }

  return (
    <div
      className="turn-line"
      ref={fieldRef}
      onKeyDownCapture={(event) => {
        // Escape peels one layer at a time: context, then the reader, then the dock.
        if (event.key !== 'Escape') return;
        if (bloom) setBloom(null);
        else if (dockOpen) setDockOpen(false);
        else if (openThreadId) setOpenThreadId(null);
        else return;
        event.stopPropagation();
      }}
    >
      <TurnLineField
        layout={layout}
        toneFor={toneFor}
        openThreadId={openThreadId}
        onSelect={selectThread}
        holdingCount={model.holdingCount}
        needsYou={amberHeld}
        clock={clockOf(model.horizon)}
        onStartConversation={() => setDockOpen(true)}
      />

      {openEntry && (
        <SeamReader
          entry={openEntry}
          bloom={bloom}
          alsoInCount={alsoInCount}
          canOpen={commands.canOpen}
          onOpenRecord={openRecord}
          onRevealRecord={revealRecord}
          onCloseBloom={() => setBloom(null)}
          onClose={() => {
            setOpenThreadId(null);
            setBloom(null);
            commands.select(null);
          }}
          onSend={send}
        />
      )}

      {bloom && openEntry && <TurnLineTether markerId={openEntry.id} caption="mentioned in" />}

      {dockOpen && (
        <AgentDock agents={liveAgents} onPick={pickAgent} onClose={() => setDockOpen(false)} />
      )}
    </div>
  );
}
