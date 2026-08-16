/**
 * A referenced object inside a conversation: context first, navigation second.
 *
 * The chip discloses what the object is where you are standing. Leaving for its Room
 * stays a separate, explicit press.
 */
import { useState } from 'react';
import { field } from '../../../../object-graph/graph';
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignCommands } from '../../messages-design';

const PREVIEW_KEYS = ['claim', 'question', 'blockedReason', 'summary', 'body', 'goal'] as const;

function previewOf(record: ObjectRecord): string {
  for (const key of PREVIEW_KEYS) {
    const value = field(record, key);
    if (value) return value;
  }
  return record.title;
}

export function ContextCapsule({
  record,
  commands,
  selected,
}: {
  record: ObjectRecord;
  commands: MessagesDesignCommands;
  selected: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="gw-capsule" data-open={open} data-selected={selected}>
      <button
        type="button"
        className="gw-capsule__chip"
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
          commands.select(record);
        }}
      >
        <span className="gw-capsule__kind">{KIND_LABEL[record.kind]}</span>
        <span className="gw-capsule__title">{record.title}</span>
      </button>

      {open && (
        <div className="gw-capsule__body">
          <p className="gw-capsule__preview">{previewOf(record)}</p>
          {field(record, 'status') && (
            <p className="gw-capsule__meta">{field(record, 'status')}</p>
          )}
          {commands.canOpen(record) && (
            <button type="button" className="gw-capsule__open" onClick={() => commands.open(record)}>
              Open {KIND_LABEL[record.kind]} ↗
            </button>
          )}
        </div>
      )}
    </div>
  );
}
