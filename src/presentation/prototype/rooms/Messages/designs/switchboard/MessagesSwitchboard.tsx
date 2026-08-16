/**
 * The Switchboard: the Messages Room as a dark field of agent lines.
 *
 * Four facts are readable from layout alone — who is alive (stem light), what is
 * recent (drop-distance), what needs you (the one amber plaque), and which
 * conversations carry a real Mission tie (a captioned hairline; standalone lines
 * simply hang free, first-class). Opening a conversation raises it as a depth plane;
 * the field dims behind it. All writes and navigation go through the design commands.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './messages-switchboard.css';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignProps } from '../../messages-design';
import { buildSwitchboardModel } from './switchboard-model';
import { TIME_TICKS } from './switchboard-layout';
import { RailColumn } from './RailColumn';
import { NewConversationRail } from './NewConversationRail';
import { OpenThread } from './OpenThread';
import { ContextCard } from './ContextCard';

export function MessagesSwitchboard({ data, commands }: MessagesDesignProps) {
  const { graph, liveAgents, selected, attentionSubjectId, initialThreadId } = data;

  const [openThreadId, setOpenThreadId] = useState<string | null>(initialThreadId ?? null);
  const [releasedThreadIds, setReleasedThreadIds] = useState<ReadonlySet<string>>(new Set());
  const [offscreenRails, setOffscreenRails] = useState(0);
  const [overlayStyle, setOverlayStyle] = useState<CSSProperties | undefined>();
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const railsRef = useRef<HTMLDivElement | null>(null);

  const model = useMemo(
    () => buildSwitchboardModel(graph, attentionSubjectId, liveAgents),
    [graph, attentionSubjectId, liveAgents],
  );

  const openThread = openThreadId ? graph.get(openThreadId) : undefined;
  const panelIsTheRoom = Boolean(initialThreadId);

  // The raised panel anchors to the Room's viewport rect, never to scrollable content.
  useEffect(() => {
    if (!openThreadId) return;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (rect) {
      setOverlayStyle({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    }
  }, [openThreadId]);

  /** How many rails currently sit past the right edge — shown so nothing falls off silently. */
  const measureOffscreenRails = () => {
    const rails = railsRef.current;
    if (!rails) return;
    const visibleRight = rails.scrollLeft + rails.clientWidth;
    const railHeads = [...rails.querySelectorAll<HTMLElement>('.swb-rail')];
    setOffscreenRails(railHeads.filter((rail) => rail.offsetLeft + 40 > visibleRight).length);
  };
  useEffect(measureOffscreenRails, [model]);

  const scrollTowardHiddenRails = () => {
    const rails = railsRef.current;
    if (rails) rails.scrollBy({ left: rails.clientWidth * 0.8, behavior: 'smooth' });
  };

  const closePanel = () => {
    commands.select(null);
    setOpenThreadId(null);
  };

  /** Answering the amber lets the attention go: sage takes over, then the panel lowers
   * itself and the field re-centres on the settled plaque so the release is seen. */
  const releaseThread = (threadId: string) => {
    setReleasedThreadIds((previous) => new Set(previous).add(threadId));
    if (panelIsTheRoom) return;
    window.setTimeout(() => {
      setOpenThreadId((current) => (current === threadId ? null : current));
      const field = fieldRef.current;
      if (field) {
        // Undo any stray programmatic scroll of the fixed frame itself.
        field.scrollLeft = 0;
        field.scrollTop = 0;
      }
      const rails = railsRef.current;
      const plaque = rails?.querySelector<HTMLElement>('.swb-plaque[data-released="true"]');
      if (rails && plaque) {
        const plaqueRect = plaque.getBoundingClientRect();
        const railsRect = rails.getBoundingClientRect();
        const centredLeft =
          plaqueRect.left - railsRect.left + rails.scrollLeft - rails.clientWidth / 2 + plaqueRect.width / 2;
        rails.scrollTo({ left: Math.max(0, centredLeft), behavior: 'smooth' });
      }
    }, 1200);
  };

  /** A mission tie clicked out on the field: disclose context without raising anything. */
  const aimAtMission = (mission: ObjectRecord) => {
    commands.select(mission);
  };

  const startWith = (agent: ObjectRecord) => {
    setOpenThreadId(commands.startConversation(agent));
  };

  return (
    <div
      ref={fieldRef}
      className="swb-field"
      data-raised={Boolean(openThread)}
      onClick={() => {
        // Touching the open field lowers the panel and clears any disclosure.
        if (selected) commands.select(null);
        else if (openThread && !panelIsTheRoom) closePanel();
      }}
    >
      <div className="swb-field__floor" aria-hidden />
      <span className="swb-field__ground-text" aria-hidden>
        Messages
      </span>

      <div className="swb-field__ticks" aria-hidden>
        {TIME_TICKS.map((tick) => (
          <div key={tick.label} className="swb-tick" style={{ top: `${tick.dropPx}px` }}>
            <span className="swb-tick__label">{tick.label}</span>
          </div>
        ))}
      </div>

      <div
        ref={railsRef}
        className="swb-field__rails"
        data-dimmed={Boolean(openThread)}
        onScroll={measureOffscreenRails}
      >
        {model.rails.map((rail) => (
          <RailColumn
            key={rail.agent?.id ?? 'unrouted'}
            rail={rail}
            releasedThreadIds={releasedThreadIds}
            onOpenThread={setOpenThreadId}
            onAimAtMission={aimAtMission}
          />
        ))}
        <NewConversationRail graph={graph} liveAgents={liveAgents} onPickAgent={startWith} />
      </div>

      {offscreenRails > 0 && !openThread && (
        <>
          <div className="swb-edge" aria-hidden />
          <button
            type="button"
            className="swb-edge__count"
            title={`${offscreenRails} more ${offscreenRails === 1 ? 'line' : 'lines'} to the right`}
            onClick={(event) => {
              event.stopPropagation();
              scrollTowardHiddenRails();
            }}
          >
            +{offscreenRails} ⟶
          </button>
        </>
      )}

      {openThread && (
        <div className="swb-overlay" style={overlayStyle}>
          <OpenThread
            thread={openThread}
            data={data}
            commands={commands}
            amber={openThread.id === model.amberThreadId}
            released={releasedThreadIds.has(openThread.id)}
            onReleased={() => releaseThread(openThread.id)}
            onClose={panelIsTheRoom ? null : closePanel}
          />
        </div>
      )}

      {/* A selection made from the field itself (a mission tie) still discloses first. */}
      {selected && !openThread && (
        <div className="swb-card-slot swb-card-slot--field" onClick={(event) => event.stopPropagation()}>
          <ContextCard
            record={selected}
            graph={graph}
            commands={commands}
            onAimAt={(record) => commands.select(record)}
            onClose={() => commands.select(null)}
          />
        </div>
      )}
    </div>
  );
}
