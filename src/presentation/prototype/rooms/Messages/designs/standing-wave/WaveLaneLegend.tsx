/**
 * Who each lane belongs to, held still while time scrolls underneath.
 *
 * An instrument's channel labels do not slide off the panel, and neither do these: the
 * legend is screen-fixed and only follows the canvas vertically, so the identity of a
 * conversation stays readable no matter how far back through the clock you pan.
 *
 * A Mission line appears only when the conversation actually has that relationship.
 * A conversation with no Mission simply shows one line fewer.
 */
import type { WorldViewport } from '../../../../components/canvas/world-camera';
import { initialsFor } from './standing-wave-model';
import type { WaveLane } from './standing-wave-projection';

function screenTopFor(lane: WaveLane, viewport: WorldViewport): number {
  return viewport.y + lane.y * viewport.zoom;
}

/**
 * The hero label is given the room to say its whole name, and its Mission when it has
 * one. Context labels keep the name and drop everything else, so they shorten by losing a
 * line rather than by cutting a word in half.
 */
function LaneEntry({
  lane,
  viewport,
  isActive,
  onChoose,
}: {
  lane: WaveLane;
  viewport: WorldViewport;
  isActive: boolean;
  onChoose: (threadId: string) => void;
}) {
  const { trace } = lane;
  const agentName = trace.agent?.title ?? 'Conversation';
  const isHero = lane.emphasis === 'hero';

  return (
    <button
      type="button"
      className="wave-legend__entry"
      data-emphasis={lane.emphasis}
      data-peak={lane.isPeak}
      data-active={isActive}
      style={{
        top: `${screenTopFor(lane, viewport)}px`,
        height: `${lane.height * viewport.zoom}px`,
      }}
      onClick={() => onChoose(lane.threadId)}
    >
      <span className="wave-legend__mark">{initialsFor(agentName)}</span>
      <span className="wave-legend__identity">
        <span className="wave-legend__role">{trace.agentRole}</span>
        <span className="wave-legend__name" title={agentName}>{agentName}</span>
        {isHero && trace.mission && (
          <span className="wave-legend__mission">{trace.mission.title}</span>
        )}
      </span>
    </button>
  );
}

/** The screen-fixed channel labels for every conversation on the canvas. */
export function WaveLaneLegend({
  lanes,
  viewport,
  activeThreadId,
  onChooseThread,
}: {
  lanes: readonly WaveLane[];
  viewport: WorldViewport;
  activeThreadId: string;
  onChooseThread: (threadId: string) => void;
}) {
  return (
    <div className="wave-legend">
      {lanes.map((lane) => (
        <LaneEntry
          key={lane.threadId}
          lane={lane}
          viewport={viewport}
          isActive={lane.threadId === activeThreadId}
          onChoose={onChooseThread}
        />
      ))}
    </div>
  );
}
