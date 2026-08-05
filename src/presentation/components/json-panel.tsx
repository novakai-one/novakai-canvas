import { useMemo } from 'react';
import type { DiagramRecord } from '../../domain/records';

/**
 * The open diagram exactly as it is stored, for reading.
 *
 * This panel used to accept an edited document back. A record now changes only through the
 * workspace's commands, so accepting hand-edited JSON would mean bypassing validation, the
 * revision check, and the operation ledger — and a textarea that silently did that is worse than
 * one that shows the truth.
 */
export function JsonPanel({ record }: { record: DiagramRecord }) {
  const raw = useMemo(() => JSON.stringify(record, null, 2), [record]);
  return (
    <div className="json-panel">
      <textarea aria-label="Diagram record JSON" readOnly spellCheck={false} value={raw} />
    </div>
  );
}
