/**
 * The empty line at the end of the field. Touching it lists the live agents as ghost
 * plaques; picking one patches a new conversation onto the board.
 */
import { useState } from 'react';
import type { ObjectGraph } from '../../../../object-graph/graph';
import type { ObjectRecord } from '../../../../object-graph/contract';

function roleOf(graph: ObjectGraph, agent: ObjectRecord): string {
  const seat = graph.relatedBy(agent.id, 'occupies')[0];
  return (seat && graph.relatedBy(seat.id, 'requests')[0]?.title) || 'Unseated';
}

export function NewConversationRail({
  graph,
  liveAgents,
  onPickAgent,
}: {
  graph: ObjectGraph;
  liveAgents: readonly ObjectRecord[];
  onPickAgent: (agent: ObjectRecord) => void;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="swb-rail swb-rail--new" data-picking={picking}>
      <button
        type="button"
        className="swb-rail__head swb-rail__head--new"
        onClick={(event) => {
          event.stopPropagation();
          setPicking((open) => !open);
        }}
      >
        <span className="swb-rail__name">{picking ? '✕' : '+'}</span>
        <span className="swb-eyebrow swb-rail__role">New line</span>
      </button>
      <div className="swb-rail__stem" aria-hidden />
      {picking && (
        <div className="swb-rail__hangs">
          {liveAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className="swb-plaque swb-plaque--pick"
              onClick={(event) => {
                event.stopPropagation();
                setPicking(false);
                onPickAgent(agent);
              }}
            >
              <span className="swb-plaque__meta">{agent.title}</span>
              <span className="swb-plaque__last">{roleOf(graph, agent)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
