/**
 * The corridor itself: floor, wordmark, dust, hanging glass and the two edge
 * affordances that admit what the haze is hiding. Racking focus is the only camera.
 */
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { CorridorPane } from './corridor-model';
import {
  DEEPEST_VISIBLE,
  NEAREST_VISIBLE,
  RACK_STEP,
  paneTransform,
  placePane,
  placeSeat,
} from './corridor-projection';
import { NewConversationDock } from './NewConversationDock';
import { PaneGlass } from './PaneGlass';

export function CorridorScene({
  panes,
  focusRank,
  focusId,
  settledId,
  liveAgents,
  pickerOpen,
  onFocus,
  onRackTo,
  onTogglePicker,
  onStartWith,
}: {
  panes: readonly CorridorPane[];
  focusRank: number;
  focusId: string | null;
  settledId: string | null;
  liveAgents: readonly ObjectRecord[];
  pickerOpen: boolean;
  onFocus: (pane: CorridorPane) => void;
  onRackTo: (rank: number) => void;
  onTogglePicker: () => void;
  onStartWith: (agent: ObjectRecord) => void;
}) {
  const deeperCount = panes.filter((pane) => pane.rank - focusRank > DEEPEST_VISIBLE).length;
  const nearerCount = panes.filter((pane) => pane.rank - focusRank < -NEAREST_VISIBLE).length;
  const seat = placeSeat(focusRank);

  return (
    <div className="rack-corridor">
      <div className="rack-floor" aria-hidden>
        <span className="rack-floor__word">Messages</span>
      </div>
      <div className="rack-dust" aria-hidden />

      <div className="rack-space">
        {!seat.hidden && (
          <div
            className="rack-slot"
            style={{ transform: paneTransform(seat), opacity: seat.opacity }}
          >
            <button
              type="button"
              className="rack-seat"
              onClick={onTogglePicker}
              aria-label="Start a conversation with an agent"
            >
              <span className="rack-seat__eyebrow">Seat open</span>
              <span className="rack-seat__hint">Start a conversation</span>
            </button>
            {pickerOpen && <NewConversationDock agents={liveAgents} onPick={onStartWith} />}
          </div>
        )}

        {panes.map((pane) => {
          const placement = placePane(pane.rank, focusRank);
          return (
            <div
              key={pane.id}
              className="rack-slot"
              data-hidden={placement.hidden}
              style={{
                transform: paneTransform(placement),
                opacity: placement.opacity,
                filter: placement.blur > 0 ? `blur(${placement.blur}px)` : 'none',
                zIndex: 100 - pane.rank + focusRank,
              }}
            >
              <PaneGlass
                pane={pane}
                focused={pane.id === focusId}
                settled={pane.id === settledId}
                onFocus={onFocus}
              />
              <span className="rack-berth" data-focused={pane.id === focusId} aria-hidden>
                {pane.berth} · {pane.lastTime}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rack-vignette" aria-hidden />

      {deeperCount > 0 && (
        <button
          type="button"
          className="rack-edge rack-edge--deeper"
          onClick={() => onRackTo(Math.min(focusRank + RACK_STEP, panes.length - 1))}
        >
          + {deeperCount} deeper
        </button>
      )}
      {nearerCount > 0 && (
        <button
          type="button"
          className="rack-edge rack-edge--nearer"
          onClick={() => onRackTo(Math.max(focusRank - RACK_STEP, 0))}
        >
          ‹ {nearerCount} nearer
        </button>
      )}
      {seat.hidden && (
        <button
          type="button"
          className="rack-edge rack-edge--seat"
          onClick={() => onRackTo(0)}
          aria-label="Walk to the front of the corridor, where the open seat is"
        >
          + open seat
        </button>
      )}
    </div>
  );
}
