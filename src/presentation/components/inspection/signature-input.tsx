import { useState } from 'react';
import { isSignatureName } from '@novakai/canvas';
import { inspectionSupport } from './support';

/** Drafted signature input which commits only valid identifiers. */
export function SignatureInput({ disabled, list, onCommit, value }: {
  value: string; disabled?: boolean; list?: boolean; onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const parts = list ? inspectionSupport.splitTypes(shown) : [shown];
  const valid = shown.trim().length === 0 ? list === true : parts.every(isSignatureName);
  const commit = (): void => {
    if (draft !== null && valid && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return <input data-invalid={!valid || undefined} disabled={disabled} onBlur={commit}
    onChange={(event) => setDraft(event.target.value)}
    onKeyDown={(event) => {
      if (event.key === 'Enter') commit();
      if (event.key === 'Escape') setDraft(null);
    }}
    title={valid ? undefined : 'Must be an identifier, like SessionHandle or Frame[]'}
    value={shown} />;
}
