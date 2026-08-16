/** The open seat's roster: pick a live agent and the seat becomes a real pane. */
import type { ObjectRecord } from '../../../../object-graph/contract';

export function NewConversationDock({
  agents,
  onPick,
}: {
  agents: readonly ObjectRecord[];
  onPick: (agent: ObjectRecord) => void;
}) {
  return (
    <div className="rack-roster" role="menu" aria-label="Live agents">
      <span className="rack-roster__eyebrow">Who do you want to talk to?</span>
      {agents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          className="rack-roster__option"
          onClick={() => onPick(agent)}
        >
          <span className="rack-roster__initials">{agent.title.slice(0, 2).toUpperCase()}</span>
          {agent.title}
        </button>
      ))}
      {agents.length === 0 && <span className="rack-roster__empty">No live agents right now.</span>}
    </div>
  );
}
