/**
 * One conversation hanging on its agent's line.
 *
 * Position, scale and contrast are set by the layout (recency); this component only
 * declares what the plaque says: how long it has been quiet, the last words spoken,
 * whether it is unread, and — for exactly one plaque in the field — that it needs you.
 */
import { field } from '../../../../object-graph/graph';
import type { SwitchboardThread } from './switchboard-model';
import { elapsedLabel } from './switchboard-layout';

export function ThreadPlaque({
  entry,
  dropPx,
  scale,
  fade,
  released,
  onOpen,
  onAimAtMission,
}: {
  entry: SwitchboardThread;
  dropPx: number;
  scale: number;
  fade: number;
  /** The amber was addressed this session: the plaque settles to sage. */
  released: boolean;
  onOpen: () => void;
  onAimAtMission: (missionElement: HTMLElement) => void;
}) {
  const amberNow = entry.amber && !released;
  const lastWords = entry.lastMessage ? field(entry.lastMessage, 'body') : 'No messages yet';

  return (
    <div
      className="swb-plaque-slot"
      style={{
        transform: `translateY(${dropPx}px)`,
        // Attention refuses atmospheric perspective: it stays full-size and lit.
        opacity: amberNow ? 1 : fade,
      }}
    >
      <button
        type="button"
        className="swb-plaque"
        data-amber={amberNow}
        data-released={released}
        data-unread={entry.unread}
        data-ghost={entry.messageCount === 0}
        style={{ transform: `scale(${amberNow ? 1 : scale})` }}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <span className="swb-plaque__meta">
          <span>{elapsedLabel(entry.elapsedMs)}</span>
          {amberNow && <span className="swb-plaque__needs-you">needs you</span>}
          {entry.unread && !amberNow && <span className="swb-plaque__unread" aria-label="Unread" />}
        </span>
        <span className="swb-plaque__last">{lastWords}</span>
      </button>
      {entry.mission && (
        <button
          type="button"
          className="swb-tie"
          title={`Mission: ${entry.mission.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onAimAtMission(event.currentTarget);
          }}
        >
          <span className="swb-tie__line" aria-hidden />
          <span className="swb-tie__label">{entry.mission.title}</span>
        </button>
      )}
    </div>
  );
}
