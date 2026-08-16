/**
 * Rack Focus: the Messages Room as a corridor of hanging glass.
 *
 * Depth is recency, glow is liveness, an etched seal is a mission binding and clear
 * glass is a standalone conversation — the unmarked base case, never a fallback.
 * Exactly one pane may be amber: the elected attention subject, physically proud of
 * its berth. Answering it settles the glass to sage. Selecting racks focus; reading
 * happens on the viewport-anchored dock; navigation only ever leaves through Open.
 */
import { useEffect, useRef, useState } from 'react';
import './messages-rack-focus.css';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignProps } from '../../messages-design';
import { buildCorridorModel, type CorridorPane } from './corridor-model';
import { CorridorScene } from './CorridorScene';
import { FocalSurface } from './FocalSurface';
import { WallInspector, type Reveal } from './WallInspector';

export function MessagesRackFocus({ data, commands }: MessagesDesignProps) {
  const model = buildCorridorModel(data);

  const [focusId, setFocusId] = useState<string | null>(model.entryPaneId);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  /** The amber pane that was just answered — holds sage until attention moves on. */
  const [settledId, setSettledId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const roomRef = useRef<HTMLDivElement>(null);

  const focused = model.panes.find((pane) => pane.id === focusId) ?? null;
  const focusRank = focused?.rank ?? 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setReveal(null);
      setPickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const focusPane = (pane: CorridorPane) => {
    setFocusId(pane.id);
    setReveal(null);
    setPickerOpen(false);
    commands.select(pane.thread);
  };

  const rackTo = (rank: number) => {
    const pane = model.panes.find((candidate) => candidate.rank === rank);
    if (pane) focusPane(pane);
  };

  /** Context first: selecting a related object lights it on the wall, nothing moves. */
  const revealRecord = (record: ObjectRecord, caption: string, anchor: HTMLElement) => {
    commands.select(record);
    const room = roomRef.current?.getBoundingClientRect();
    if (!room) return;
    const chip = anchor.getBoundingClientRect();
    setReveal({
      record,
      caption,
      anchor: { x: chip.left - room.left, y: chip.top - room.top + chip.height / 2 },
      room: { width: room.width, height: room.height },
    });
  };

  const send = (body: string) => {
    if (!focused) return;
    commands.send(focused.id, body);
    // Answering the amber conversation is the release: its glass settles to sage.
    if (focused.amber) setSettledId(focused.id);
  };

  const startWith = (agent: ObjectRecord) => {
    const threadId = commands.startConversation(agent);
    setPickerOpen(false);
    setFocusId(threadId);
  };

  return (
    <div className="rack-room" ref={roomRef}>
      <CorridorScene
        panes={model.panes}
        focusRank={focusRank}
        focusId={focusId}
        settledId={settledId}
        liveAgents={data.liveAgents}
        pickerOpen={pickerOpen}
        onFocus={focusPane}
        onRackTo={rackTo}
        onTogglePicker={() => setPickerOpen((open) => !open)}
        onStartWith={startWith}
      />

      <FocalSurface
        pane={focused}
        revealedId={reveal?.record.id ?? null}
        onReveal={revealRecord}
        onSend={send}
      />

      {reveal && (
        <WallInspector
          reveal={reveal}
          canOpen={commands.canOpen(reveal.record)}
          onOpen={() => commands.open(reveal.record)}
          onClose={() => {
            setReveal(null);
            commands.select(null);
          }}
        />
      )}
    </div>
  );
}
