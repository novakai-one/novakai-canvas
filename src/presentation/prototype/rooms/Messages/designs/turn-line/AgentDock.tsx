/**
 * Starting a conversation: pick who, not what.
 *
 * The dock lists agents with a working presence right now. No Mission is chosen and
 * none is required — a conversation begins because there is someone to talk to.
 */
import type { ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';

export function AgentDock({
  agents,
  onPick,
  onClose,
}: {
  agents: readonly ObjectRecord[];
  onPick: (agent: ObjectRecord) => void;
  onClose: () => void;
}) {
  return (
    <div className="tl-dock" role="dialog" aria-label="Start a conversation">
      <div className="tl-dock__head">
        <p className="tl-dock__title">Start a conversation</p>
        <button type="button" className="tl-dock__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {agents.length === 0 ? (
        <p className="tl-dock__empty">No agent is working right now. Spawn one to talk to it.</p>
      ) : (
        <ul className="tl-dock__list">
          {agents.map((agent) => (
            <li key={agent.id}>
              <button type="button" onClick={() => onPick(agent)}>
                <span className="tl-dock__name">{agent.title}</span>
                <span className="tl-dock__detail">{field(agent, 'provider') || 'agent'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
