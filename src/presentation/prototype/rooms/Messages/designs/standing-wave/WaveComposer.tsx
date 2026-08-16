/**
 * The composer, docked at the now end of the open conversation.
 *
 * Send stays a ghost outline while an unresolved ask is still holding the Room's one gold
 * accent, and only takes the solid fill once nothing is waiting on Chris. Exactly one gold
 * thing on screen at a time is the rule, so the primary action defers to the debt.
 */
import { useState } from 'react';

/** Writes into the open conversation and extends its trace to now. */
export function WaveComposer({
  agentName,
  peakIsUnresolved,
  onSend,
}: {
  agentName: string;
  peakIsUnresolved: boolean;
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();

  const submit = () => {
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
  };

  return (
    <form
      className="wave-composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        className="wave-composer__input"
        value={draft}
        placeholder={`Message ${agentName}`}
        aria-label={`Message ${agentName}`}
        rows={2}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <button
        type="submit"
        className="wave-composer__send"
        data-quiet={peakIsUnresolved}
        disabled={!trimmed}
      >
        Send
      </button>
    </form>
  );
}
