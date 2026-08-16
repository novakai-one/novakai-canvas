/**
 * One conversation, standing on the floor.
 *
 * Every attribute here is a lever with a job: fill says the turn is yours, size says
 * how much has been said, tier says how much detail survives the distance, and the
 * elected body alone leaves the plane — urgency you can see from across the room.
 */
import type { CSSProperties } from 'react';
import { initialsOf } from './agent-labels';
import type { PlacedBody } from './orbit-geometry';
import type { OrbitBody as OrbitBodyModel } from './orbit-model';

export type BodyState = {
  /** Its reading surface is open. */
  readonly active: boolean;
  /** The host's selection points at this conversation. */
  readonly selected: boolean;
  /** The single gold signal on screen. */
  readonly elected: boolean;
  /** Answered: the gold settles to sage and the body lowers. */
  readonly released: boolean;
};

export function OrbitBody({
  placed,
  state,
  onOpen,
}: {
  placed: PlacedBody;
  state: BodyState;
  onOpen(body: OrbitBodyModel): void;
}) {
  const { body } = placed;
  const name = body.agent?.title ?? 'Conversation';
  const context = body.mission ? body.mission.title : 'direct thread';

  return (
    <button
      type="button"
      className="gw-body"
      style={
        {
          '--x': `${placed.x}px`,
          '--y': `${placed.y}px`,
          '--size': `${placed.size}px`,
          '--shade-x': placed.shadeX,
          '--shade-y': placed.shadeY,
        } as CSSProperties
      }
      data-tier={placed.tier}
      data-band={body.band}
      data-awaiting={body.awaitingYou}
      data-live={body.live}
      data-direct={body.mission === null}
      data-unopened={body.unopened}
      data-elected={state.elected}
      data-released={state.released}
      data-active={state.active}
      data-selected={state.selected}
      aria-label={`${name} · ${context}`}
      onClick={() => onOpen(body)}
    >
      <span className="gw-body__cast" aria-hidden="true" />
      <span className="gw-body__riser" aria-hidden="true" />
      <span className="gw-body__disc">
        <span className="gw-body__initials">{initialsOf(name)}</span>
      </span>
      {state.elected && !state.released && <span className="gw-body__tab">Needs you</span>}
      <span className="gw-body__label">{name}</span>
      <span className="gw-body__line">{body.lastLine}</span>
    </button>
  );
}
