import { useEffect, useState } from 'react';
import type { ArchitectureDocument } from '../../domain/model';
import { architectureDocumentSchema } from '../../domain/schema';

export function JsonPanel({ document, replace }: { document: ArchitectureDocument; replace: (next: ArchitectureDocument) => void }) {
  const [raw, setRaw] = useState(() => JSON.stringify(document, null, 2));
  const [error, setError] = useState('');
  useEffect(() => setRaw(JSON.stringify(document, null, 2)), [document]);
  const apply = (): void => {
    try {
      replace(architectureDocumentSchema.parse(JSON.parse(raw)));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid JSON');
    }
  };
  return (
    <div className="json-panel">
      <textarea aria-label="Architecture JSON" spellCheck={false} value={raw} onChange={(event) => setRaw(event.target.value)} />
      {error && <div className="json-error">{error}</div>}
      <button className="primary-action" onClick={apply} type="button">Apply JSON</button>
    </div>
  );
}
