/**
 * Context first, navigation second.
 *
 * Selecting a referenced object opens it here, beside the turn that cited it. Nothing
 * has moved yet: you can read what the object is, see how many other conversations are
 * carrying it, and only then take the explicit action that changes Room.
 */
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import { RoomAction } from '../../../../components/ui/ui';

/** The one field worth reading before you decide to open something. */
function summaryOf(record: ObjectRecord): string {
  const summary =
    field(record, 'body') ||
    field(record, 'question') ||
    field(record, 'summary') ||
    field(record, 'statement') ||
    field(record, 'intent') ||
    field(record, 'doneCheck');
  return summary === record.title ? '' : summary;
}

export function ContextBloom({
  record,
  alsoIn,
  canOpen,
  onOpen,
  onClose,
}: {
  record: ObjectRecord;
  alsoIn: number;
  canOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const status = field(record, 'status') || field(record, 'state');

  return (
    <div className="tl-bloom" data-tether-anchor="bloom">
      <div className="tl-bloom__head">
        <span className="tl-bloom__kind">{KIND_LABEL[record.kind]}</span>
        <button type="button" className="tl-bloom__close" onClick={onClose} aria-label="Close context">
          ×
        </button>
      </div>
      <p className="tl-bloom__title">{record.title}</p>
      {summaryOf(record) && <p className="tl-bloom__summary">{summaryOf(record)}</p>}
      {status && <p className="tl-bloom__status">{status}</p>}
      {alsoIn > 0 && (
        <p className="tl-bloom__also">{`Also in ${alsoIn} other conversation${alsoIn === 1 ? '' : 's'}`}</p>
      )}
      {canOpen && <RoomAction onClick={onOpen}>{`Open ${KIND_LABEL[record.kind]}`}</RoomAction>}
    </div>
  );
}
