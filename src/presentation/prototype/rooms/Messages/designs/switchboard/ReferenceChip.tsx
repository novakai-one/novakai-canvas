/**
 * An object cited inside a message. Clicking it selects — never navigates — and tells
 * the panel where it sits so the disclosure card can tether to it.
 */
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';

export function ReferenceChip({
  record,
  selected,
  onSelect,
}: {
  record: ObjectRecord;
  selected: boolean;
  onSelect: (record: ObjectRecord, chipElement: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      className="swb-chip"
      data-selected={selected}
      onClick={(event) => onSelect(record, event.currentTarget)}
    >
      <span className="swb-eyebrow">{KIND_LABEL[record.kind]}</span>
      {record.title}
    </button>
  );
}
