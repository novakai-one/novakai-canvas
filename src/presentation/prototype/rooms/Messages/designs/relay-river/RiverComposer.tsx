import { useEffect, useState, type FormEvent } from 'react';
import type { RiverThread } from './relay-river-model';

/** Keeps message composition stable while the river pans beneath it. */
export function RiverComposer({
  thread,
  onSend,
}: {
  thread: RiverThread | null;
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState('');

  useEffect(() => setDraft(''), [thread?.record.id]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!thread || !body) return;
    onSend(body);
    setDraft('');
  };

  return (
    <form className="river-composer" onSubmit={submit}>
      <label htmlFor="relay-river-message">
        <span>Send downstream</span>
        <textarea
          id="relay-river-message"
          value={draft}
          rows={2}
          disabled={!thread}
          placeholder={thread ? `Message ${thread.agent?.title ?? 'this conversation'}` : 'Choose a conversation'}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
      </label>
      <button type="submit" disabled={!thread || !draft.trim()}>Send</button>
    </form>
  );
}
