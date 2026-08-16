/**
 * The Messages Room as a gravity well.
 *
 * You are the core. A conversation's distance from you is how long ago its last turn
 * was taken, its sector is the Mission that owns it — or the direct sector, which is
 * drawn with exactly the same grammar — and only one conversation is ever gold.
 *
 * This module owns the Room's state: which conversation is open, which gold signal has
 * been released, and how large the floor is. Everything it needs arrives through the
 * Messages design contract.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import './messages-gravity-well.css';
import { EmptyState } from '../../../../components/ui/ui';
import type { MessagesDesignProps } from '../../messages-design';
import { ReadingSurface } from './ReadingSurface';
import { WellField } from './WellField';
import { initialsOf, roleOf } from './agent-labels';
import { RING_TICKS, layoutField, type FieldSize } from './orbit-geometry';
import { buildOrbitField, type TurnBand } from './orbit-model';

export function MessagesGravityWell({ data, commands }: MessagesDesignProps) {
  const { graph, selected, initialThreadId, liveAgents } = data;
  const [size, setSize] = useState<FieldSize>({ width: 0, height: 0 });
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId ?? null);
  const [releasedIds, setReleasedIds] = useState<ReadonlySet<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const floorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const floor = floorRef.current;
    if (!floor) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(floor);
    return () => observer.disconnect();
  }, []);

  const field = useMemo(() => buildOrbitField(data), [data]);
  const layout = useMemo(() => layoutField(field, size), [field, size]);

  const activeThread = activeThreadId ? graph.get(activeThreadId) : undefined;
  const activeBand: TurnBand | null =
    field.bodies.find((body) => body.thread.id === activeThreadId)?.band ??
    field.bodies.find((body) => body.thread.id === field.electedThreadId)?.band ??
    null;

  const send = (threadId: string, body: string) => {
    commands.send(threadId, body);
    if (threadId === field.electedThreadId) {
      setReleasedIds((released) => new Set(released).add(threadId));
    }
  };

  if (field.bodies.length === 0) {
    return (
      <div className="gw">
        <EmptyState>No conversations yet. Start one with a live agent.</EmptyState>
      </div>
    );
  }

  return (
    <div
      className="gw"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setPickerOpen(false);
          setActiveThreadId(null);
        }
      }}
    >
      <div className="gw-start">
        <button
          type="button"
          className="gw-start__button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
        >
          {pickerOpen ? 'Close' : 'Start a conversation'}
        </button>
        {pickerOpen && (
          <div className="gw-picker">
            <span className="gw-picker__head">
              Live agents <span className="gw-picker__count">{liveAgents.length}</span>
            </span>
            <div className="gw-picker__list">
              {liveAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className="gw-picker__option"
                  onClick={() => {
                    setActiveThreadId(commands.startConversation(agent));
                    setPickerOpen(false);
                  }}
                >
                  <span className="gw-picker__avatar">{initialsOf(agent.title)}</span>
                  <span className="gw-picker__identity">
                    <span className="gw-picker__name">{agent.title}</span>
                    <span className="gw-picker__role">{roleOf(graph, agent)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="gw-ambient">
        <span>{field.liveCount} live</span>
        <span className="gw-ambient__divider" />
        <span>{field.awaitingCount} awaiting you</span>
      </div>

      {/* The floor makes room for an open conversation rather than hiding behind it. */}
      <div className="gw-floor-area" data-inset={Boolean(activeThread)} ref={floorRef}>
        {size.width > 0 && (
          <WellField
            layout={layout}
            field={field}
            activeThreadId={activeThreadId}
            selectedId={selected?.id ?? null}
            releasedIds={releasedIds}
            onOpen={(body) => {
              setActiveThreadId(body.thread.id);
              commands.select(body.thread);
            }}
          />
        )}
      </div>

      <div className="gw-legend">
        <span className="gw-legend__axis">Turn age</span>
        <span className="gw-legend__scale">
          {RING_TICKS.map((band) => (
            <span key={band} className="gw-legend__tick" data-active={band === activeBand}>
              {band}
            </span>
          ))}
        </span>
      </div>

      {activeThread && (
        <ReadingSurface
          graph={graph}
          thread={activeThread}
          commands={commands}
          selectedId={selected?.id ?? null}
          onSend={send}
          onClose={() => setActiveThreadId(null)}
        />
      )}
    </div>
  );
}
