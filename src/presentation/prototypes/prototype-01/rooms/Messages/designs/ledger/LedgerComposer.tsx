/**
 * The writing surface of the focused band, and the folio's agent picker.
 *
 * The composer is one of only two raised surfaces in the Room. The folio variant is
 * a dashed ghost — not yet real ink — that solidifies when a conversation begins.
 */
import { useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { ActionButton } from '../../../../components/ui/ui';
import { useLedgerUi } from './ledger-context';

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function LedgerComposer({ bandId, agentName }: { bandId: string; agentName: string }) {
  const ui = useLedgerUi();
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!draft.trim()) return;
    ui.send(bandId, draft.trim());
    setDraft('');
  };

  return (
    <div className="ledger-composer">
      <textarea
        className="ledger-composer__input"
        value={draft}
        rows={2}
        placeholder={`Write to ${agentName}`}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
      />
      <ActionButton variant="primary" onClick={send} disabled={!draft.trim()}>
        Send
      </ActionButton>
    </div>
  );
}

/** The blank folio: pick who the correspondence is with. */
export function FolioPicker({ agents }: { agents: readonly ObjectRecord[] }) {
  const ui = useLedgerUi();
  return (
    <div className="ledger-folio" role="group" aria-label="Start a conversation">
      <span className="eyebrow">New folio</span>
      <p className="ledger-folio__lead">Who is this correspondence with?</p>
      {agents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          className="ledger-folio__option"
          onClick={(event) => {
            event.stopPropagation();
            ui.pickAgent(agent);
          }}
        >
          <span className="ledger-folio__avatar">{initials(agent.title)}</span>
          <span className="ledger-folio__who">
            <span className="ledger-folio__name">{agent.title}</span>
            <span className="ledger-folio__role">{ui.roleOf(agent)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
