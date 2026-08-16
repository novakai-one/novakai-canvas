/**
 * The reading surface, held against the viewport.
 *
 * Opening a conversation parts the seam into this panel. It floats a whole layer above
 * the plane — anchored to the window, never inside the field — so the block you opened
 * stays lit where you left it and you never lose your place. What the conversation is
 * attached to is stated here, and a conversation attached to nothing but its Agent
 * simply lists one line instead of two.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { RoomAction } from '../../../../components/ui/ui';
import { ContextBloom } from './ContextBloom';
import { formatWait, type TurnLineThread } from './turn-line-model';

export type BloomTarget = { readonly messageId: string; readonly record: ObjectRecord };

function AttachedRow({
  label,
  record,
  canOpen,
  onOpen,
}: {
  label: string;
  record: ObjectRecord;
  canOpen: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="tl-reader__attached-row">
      <span className="tl-reader__attached-label">{label}</span>
      <span className="tl-reader__attached-title">{record.title}</span>
      {canOpen && <RoomAction onClick={onOpen}>Open</RoomAction>}
    </div>
  );
}

export function SeamReader({
  entry,
  bloom,
  alsoInCount,
  canOpen,
  onOpenRecord,
  onRevealRecord,
  onCloseBloom,
  onClose,
  onSend,
}: {
  entry: TurnLineThread;
  bloom: BloomTarget | null;
  alsoInCount: number;
  canOpen: (record: ObjectRecord) => boolean;
  onOpenRecord: (record: ObjectRecord) => void;
  onRevealRecord: (messageId: string, record: ObjectRecord) => void;
  onCloseBloom: () => void;
  onClose: () => void;
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [hiddenAbove, setHiddenAbove] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // A conversation opens at its most recent turn, and a turn you just sent is a turn
  // you must be able to see.
  useLayoutEffect(() => {
    const surface = scrollRef.current;
    if (surface) surface.scrollTop = surface.scrollHeight;
  }, [entry.id, entry.messages.length]);

  useLayoutEffect(() => setDraft(''), [entry.id]);

  useEffect(() => {
    const surface = scrollRef.current;
    if (!surface) return;
    const measure = () => {
      const turns = Array.from(surface.querySelectorAll<HTMLElement>('[data-turn]'));
      setHiddenAbove(
        turns.filter((turn) => turn.offsetTop + turn.offsetHeight < surface.scrollTop).length,
      );
    };
    measure();
    surface.addEventListener('scroll', measure, { passive: true });
    return () => surface.removeEventListener('scroll', measure);
  }, [entry.id, bloom]);

  const holderLine =
    entry.holder === 'you'
      ? `Your move · waiting ${formatWait(entry.waitMs)}`
      : `Waiting on ${entry.name} · ${formatWait(entry.waitMs)}`;

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft('');
  };

  return (
    <aside className="tl-reader" aria-label={`Conversation with ${entry.name}`}>
      <header className="tl-reader__head">
        <span className="tl-reader__mono" aria-hidden="true">
          {entry.monogram}
        </span>
        <span className="tl-reader__identity">
          <span className="tl-reader__kind">Agent</span>
          <span className="tl-reader__name">{entry.name}</span>
          <span className="tl-reader__holder" data-side={entry.holder}>
            {holderLine}
          </span>
        </span>
        {entry.live && <span className="tl-reader__live">live</span>}
        <button type="button" className="tl-reader__close" onClick={onClose} aria-label="Close conversation">
          ×
        </button>
      </header>

      <div className="tl-reader__attached">
        {entry.agent && (
          <AttachedRow
            label="Agent"
            record={entry.agent}
            canOpen={canOpen(entry.agent)}
            onOpen={() => onOpenRecord(entry.agent as ObjectRecord)}
          />
        )}
        {entry.mission && (
          <AttachedRow
            label="Mission"
            record={entry.mission}
            canOpen={canOpen(entry.mission)}
            onOpen={() => onOpenRecord(entry.mission as ObjectRecord)}
          />
        )}
      </div>

      {hiddenAbove > 0 && (
        <p className="tl-reader__earlier">{`${hiddenAbove} earlier`}</p>
      )}

      <div className="tl-reader__scroll" ref={scrollRef}>
        {entry.messages.length === 0 && (
          <p className="tl-reader__opening">Say the first thing and this conversation begins.</p>
        )}
        {entry.messages.map((message) => (
          <div className="tl-reader__turn" data-turn data-mine={message.mine || undefined} key={message.record.id}>
            <p className="tl-reader__byline">{`${message.speaker} · ${message.time}`}</p>
            <p className="tl-reader__body">{message.record.title}</p>
            {message.references.length > 0 && (
              <div className="tl-reader__chips">
                {message.references.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    className="tl-reader__chip"
                    data-revealed={
                      bloom?.record.id === record.id && bloom.messageId === message.record.id
                        ? true
                        : undefined
                    }
                    onClick={() => onRevealRecord(message.record.id, record)}
                  >
                    {record.title}
                  </button>
                ))}
              </div>
            )}
            {bloom && bloom.messageId === message.record.id && (
              <ContextBloom
                record={bloom.record}
                alsoIn={alsoInCount}
                canOpen={canOpen(bloom.record)}
                onOpen={() => onOpenRecord(bloom.record)}
                onClose={onCloseBloom}
              />
            )}
          </div>
        ))}
      </div>

      <div className="tl-reader__composer">
        <textarea
          className="tl-reader__draft"
          value={draft}
          placeholder={`Message ${entry.name}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
          }}
        />
        <button type="button" className="tl-reader__send" onClick={submit} disabled={!draft.trim()}>
          Send
        </button>
      </div>
    </aside>
  );
}
