/**
 * A cited object in the margin: disclose here, open elsewhere.
 *
 * The gloss is the Room-local inspector. It floats level with the sentence that
 * cited the object, and its left rule continues the row's hairline — selection and
 * inspector are visibly one line. `Inspect` and `Open ↗` are the only exits.
 */
import { field } from '../../../../object-graph/graph';
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { ActionButton, RoomAction, StateChip } from '../../../../components/ui/ui';
import { roomFor } from '../../../../room-navigation/room-for';
import { useLedgerUi } from './ledger-context';

export function MarginGloss({
  record,
  bandId,
  messageId,
  amber,
  released,
}: {
  record: ObjectRecord;
  bandId: string;
  messageId: string;
  amber: boolean;
  released: boolean;
}) {
  const ui = useLedgerUi();
  const open =
    ui.gloss?.bandId === bandId &&
    ui.gloss?.messageId === messageId &&
    ui.gloss?.citationId === record.id;
  const preview =
    field(record, 'claim') || field(record, 'question') || field(record, 'blockedReason') || field(record, 'body');
  const status = field(record, 'status');
  const room = roomFor(record);

  return (
    <div
      className="ledger-citation"
      data-open={open}
      data-amber={amber && !released}
      data-released={amber && released}
    >
      <button
        type="button"
        className="ledger-citation__cite"
        onClick={(event) => {
          event.stopPropagation();
          if (open) ui.closeGloss();
          else ui.openGloss({ bandId, messageId, citationId: record.id });
        }}
      >
        <span className="eyebrow">{KIND_LABEL[record.kind]}</span>
        <span className="ledger-citation__title">{record.title}</span>
      </button>
      {open && (
        <div className="ledger-gloss" role="group" aria-label={`${KIND_LABEL[record.kind]} context`}>
          <header className="ledger-gloss__head">
            <span className="eyebrow">{KIND_LABEL[record.kind]}</span>
            <strong className="ledger-gloss__title">{record.title}</strong>
          </header>
          {preview && <p className="ledger-gloss__preview">{preview}</p>}
          {status && <StateChip state={status} />}
          <div className="ledger-gloss__actions">
            <ActionButton variant="ghost" onClick={() => ui.inspect(record.id)}>
              Inspect
            </ActionButton>
            {room && (
              <RoomAction onClick={() => ui.openRecord(record)}>
                Open {KIND_LABEL[record.kind]}
              </RoomAction>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
