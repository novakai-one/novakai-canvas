import { useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { countByBand, type BandTally } from './vigil-geometry';
import type { VigilAgent } from './vigil-model';

/**
 * Everything that sits between you and the floor: the fog, the axis legend and the
 * shelf of agents you can start talking to.
 *
 * These stay in screen space on purpose. Fog is between the viewer and the world, so
 * it should not zoom with it, and the legend has to stay readable at every tier.
 */
export function VigilScreenLayer({
  agents,
  silentMinutesEach,
  coreOpen,
  onStartConversation,
}: {
  agents: readonly VigilAgent[];
  silentMinutesEach: readonly number[];
  coreOpen: boolean;
  onStartConversation: (agent: ObjectRecord) => void;
}) {
  return (
    <>
      <div className="vigil-fog" aria-hidden="true" />
      {coreOpen && <div className="vigil-core-scrim" aria-hidden="true" />}
      <SilenceLegend tallies={countByBand(silentMinutesEach)} />
      <AgentShelf agents={agents} onStartConversation={onStartConversation} />
    </>
  );
}

/**
 * Names the one axis the whole floor is built on, and accounts for every ring.
 *
 * The outermost ring draws as marks with no names, so its count lives here — the
 * conversations out there are quiet, not hidden.
 */
function SilenceLegend({ tallies }: { tallies: readonly BandTally[] }) {
  return (
    <div className="vigil-legend">
      <span className="vigil-legend__title">Silence</span>
      {tallies.map((tally) => (
        <span key={tally.label} className="vigil-legend__band" data-depth={tally.depth}>
          {tally.label}
          <em>{tally.count}</em>
        </span>
      ))}
    </div>
  );
}

/**
 * Live agents you can light a new conversation with.
 *
 * Closed by default: on entry the floor should be the only thing asking for attention,
 * and a standing list of every agent competes with it.
 */
function AgentShelf({
  agents,
  onStartConversation,
}: {
  agents: readonly VigilAgent[];
  onStartConversation: (agent: ObjectRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  if (agents.length === 0) return null;

  return (
    <div className="vigil-shelf" data-open={open}>
      <button
        type="button"
        className="vigil-shelf__trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Start a conversation
        <em>{agents.length}</em>
      </button>
      {open && (
        <div className="vigil-shelf__panel">
          {agents.map((agent) => (
            <button
              key={agent.record.id}
              type="button"
              className="vigil-shelf__agent"
              onClick={() => {
                onStartConversation(agent.record);
                setOpen(false);
              }}
            >
              <strong>{agent.record.title}</strong>
              <span>{agent.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
