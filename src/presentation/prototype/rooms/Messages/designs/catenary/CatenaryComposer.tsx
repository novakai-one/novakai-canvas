import { useEffect, useState, type FormEvent } from 'react';
import type { Cable } from './catenary-model';

/**
 * Your end of the cable.
 *
 * Send carries the accent only while this cable is under load, because replying is
 * the act that releases it. On a settled cable the control stays quiet.
 */
export function CatenaryComposer({
  cable,
  onSend,
}: {
  cable: Cable | null;
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState('');

  useEffect(() => setDraft(''), [cable?.record.id]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!cable || !body) return;
    onSend(body);
    setDraft('');
  };

  return (
    <form className="catenary-composer" data-loaded={Boolean(cable?.load)} onSubmit={submit}>
      <label htmlFor="catenary-reply">
        <span>{cable?.load ? 'Release this cable' : 'Your end'}</span>
        <textarea
          id="catenary-reply"
          value={draft}
          rows={2}
          disabled={!cable}
          placeholder={cable ? `Reply to ${cable.agentName}` : 'Choose a cable'}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
      </label>
      <button type="submit" disabled={!cable || !draft.trim()}>Send</button>
    </form>
  );
}
