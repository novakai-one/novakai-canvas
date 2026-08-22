import { useState } from 'react';

/** Shared inline node-title editor. Double-click edits; Enter commits; Escape restores. */
export function NodeLabel({
  editable, label, rename,
}: {
  label: string;
  editable: boolean;
  rename: (next: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null) {
    return <span
      className={`node-label${editable ? ' is-renamable' : ''}`}
      onDoubleClick={editable ? (event) => { event.stopPropagation(); setDraft(label); } : undefined}
      title={editable ? 'Double-click to rename' : undefined}
    >{label}</span>;
  }
  const commit = (): void => {
    if (draft.trim().length > 0 && draft !== label) rename(draft.trim());
    setDraft(null);
  };
  return <input
    autoFocus className="node-label-input nodrag nopan"
    onBlur={commit}
    onChange={(event) => setDraft(event.target.value)}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === 'Enter') commit();
      if (event.key === 'Escape') setDraft(null);
    }}
    onPointerDown={(event) => event.stopPropagation()}
    value={draft}
  />;
}
