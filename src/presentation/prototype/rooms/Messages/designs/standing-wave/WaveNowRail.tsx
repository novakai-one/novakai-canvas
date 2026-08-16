/**
 * Live agents, standing at the now end of the clock.
 *
 * Choosing an agent who already has a conversation opens that lane. Choosing one who does
 * not starts a standalone conversation — no Mission is required, invented or implied.
 */
import { initialsFor, type WaveAgent } from './standing-wave-model';

function AgentMark({
  agent,
  isActive,
  onChoose,
}: {
  agent: WaveAgent;
  isActive: boolean;
  onChoose: (agent: WaveAgent) => void;
}) {
  return (
    <button
      type="button"
      className="wave-now-rail__agent"
      data-active={isActive}
      data-open={agent.threadId !== null}
      title={`${agent.record.title} · ${agent.role}`}
      onClick={() => onChoose(agent)}
    >
      <span className="wave-now-rail__mark">{initialsFor(agent.record.title)}</span>
      <span className="wave-now-rail__name">{agent.record.title}</span>
    </button>
  );
}

/** The live roster at the now line, and the way a new conversation begins. */
export function WaveNowRail({
  agents,
  activeThreadId,
  onChooseAgent,
}: {
  agents: readonly WaveAgent[];
  activeThreadId: string;
  onChooseAgent: (agent: WaveAgent) => void;
}) {
  if (agents.length === 0) return null;

  return (
    <aside className="wave-now-rail" aria-label="Live agents">
      <span className="wave-now-rail__title">Live</span>
      {agents.map((agent) => (
        <AgentMark
          key={agent.record.id}
          agent={agent}
          isActive={agent.threadId !== null && agent.threadId === activeThreadId}
          onChoose={onChooseAgent}
        />
      ))}
    </aside>
  );
}
