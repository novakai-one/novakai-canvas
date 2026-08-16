import { useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { CatenaryModel } from './catenary-model';

/**
 * Strings a new cable to a live Agent.
 *
 * The conversation that appears needs nothing else to be complete: an Agent at one
 * end, you at the other, and no load yet.
 */
export function NewCablePicker({
  agents,
  onStartConversation,
}: {
  agents: CatenaryModel['agents'];
  onStartConversation: (agent: ObjectRecord) => void;
}) {
  const [open, setOpen] = useState(false);

  const choose = (agent: ObjectRecord) => {
    setOpen(false);
    onStartConversation(agent);
  };

  return (
    <div className="catenary-picker" data-open={open}>
      <button
        type="button"
        className="catenary-picker__toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        New conversation
      </button>
      {open && (
        <ul className="catenary-picker__list">
          {agents.map((agent) => (
            <li key={agent.record.id}>
              <button type="button" onClick={() => choose(agent.record)}>
                <strong>{agent.record.title}</strong>
                <small>{agent.role}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
