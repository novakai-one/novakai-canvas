/**
 * One agent's vertical line: name and role at the head, a light stem falling to the
 * floor, conversations hanging along it by recency. Stem luminance is liveness.
 */
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { SwitchboardRail } from './switchboard-model';
import { dropPx, plaqueFade, plaqueScale, stackedDrops } from './switchboard-layout';
import { ThreadPlaque } from './ThreadPlaque';

/** Vertical room one plaque needs before the next may hang below it. */
const PLAQUE_CLEARANCE_PX = 96;

export function RailColumn({
  rail,
  releasedThreadIds,
  onOpenThread,
  onAimAtMission,
}: {
  rail: SwitchboardRail;
  releasedThreadIds: ReadonlySet<string>;
  onOpenThread: (threadId: string) => void;
  onAimAtMission: (mission: ObjectRecord, missionElement: HTMLElement) => void;
}) {
  const drops = stackedDrops(
    rail.threads.map((entry) => dropPx(entry.elapsedMs)),
    PLAQUE_CLEARANCE_PX,
  );

  return (
    <div className="swb-rail" data-live={rail.live}>
      <div className="swb-rail__head">
        <span className="swb-rail__name">{rail.name}</span>
        {rail.role && <span className="swb-eyebrow swb-rail__role">{rail.role}</span>}
      </div>
      <div className="swb-rail__stem" aria-hidden />
      <div className="swb-rail__hangs">
        {rail.threads.map((entry, index) => (
          <ThreadPlaque
            key={entry.thread.id}
            entry={entry}
            dropPx={drops[index]}
            scale={plaqueScale(entry.elapsedMs)}
            fade={plaqueFade(entry.elapsedMs)}
            released={releasedThreadIds.has(entry.thread.id)}
            onOpen={() => onOpenThread(entry.thread.id)}
            onAimAtMission={(element) => entry.mission && onAimAtMission(entry.mission, element)}
          />
        ))}
      </div>
    </div>
  );
}
