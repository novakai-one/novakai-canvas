/** How an agent is named on the floor and in the reading surface. Presentation only. */
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import type { ObjectRecord } from '../../../../object-graph/contract';

/** Two letters, taken from the first two words so "Manager Kimi UX" reads MK. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}

/** The Role its Seat requests, falling back to the provider that runs it. */
export function roleOf(graph: ObjectGraph, agent: ObjectRecord | null): string {
  if (!agent) return '';
  const seat = graph.relatedBy(agent.id, 'occupies')[0];
  const role = seat ? graph.relatedBy(seat.id, 'requests')[0] : undefined;
  return role?.title ?? field(agent, 'provider');
}
