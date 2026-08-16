/**
 * A selectable projection of any object, for the library Rooms.
 *
 * Same two-control rule as everywhere else: the card body selects and opens the
 * inspector, and the arrow — a visibly different control — enters that object's Room.
 */
import type { ReactNode } from 'react';
import './object-card.css';
import { useStore } from '../../app/store';
import { KIND_LABEL, type ObjectRecord } from '../../object-graph/contract';
import { roomFor } from '../../room-navigation/room-for';

export function ObjectCard({
  record,
  summary,
  meta,
  footer,
}: {
  record: ObjectRecord;
  summary?: string;
  meta?: ReactNode;
  footer?: ReactNode;
}) {
  const { select, selected, enterRoom, elected } = useStore();
  const room = roomFor(record);

  return (
    <article
      className="object-card"
      data-selected={selected?.id === record.id}
      data-attention={elected?.subject.id === record.id}
    >
      <button type="button" className="object-card__body" onClick={() => select(record.id)}>
        <span className="object-card__head">
          <span className="eyebrow">{KIND_LABEL[record.kind]}</span>
          {meta}
        </span>
        <span className="object-card__title">{record.title}</span>
        {summary && <span className="object-card__summary">{summary}</span>}
      </button>
      {(footer || room) && (
        <div className="object-card__footer">
          <div className="object-card__footer-left">{footer}</div>
          {room && (
            <button
              type="button"
              className="object-card__open"
              title={`Open ${KIND_LABEL[record.kind]}`}
              aria-label={`Open ${record.title}`}
              onClick={() => enterRoom(room)}
            >
              Open
              <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
