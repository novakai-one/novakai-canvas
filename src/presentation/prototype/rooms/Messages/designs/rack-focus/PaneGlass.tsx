/**
 * One conversation as hanging glass. Everything on the pane is state made physical:
 * sage inner light = live agent, etched seal = mission binding, clear glass = standalone,
 * amber extrusion + flag = the one thing that needs you, sage flag = just released.
 */
import type { CorridorPane } from './corridor-model';

export function PaneGlass({
  pane,
  focused,
  settled,
  onFocus,
}: {
  pane: CorridorPane;
  focused: boolean;
  /** True right after the amber decision was answered from this pane. */
  settled: boolean;
  onFocus: (pane: CorridorPane) => void;
}) {
  const amber = pane.amber && !settled;

  return (
    <button
      type="button"
      className="rack-pane"
      data-focused={focused}
      data-amber={amber}
      data-settled={settled}
      data-live={pane.live}
      data-unread={pane.unread}
      onClick={() => onFocus(pane)}
      aria-label={`Focus conversation with ${pane.agentName}`}
    >
      {(amber || settled) && (
        <>
          <span className="rack-pane__side rack-pane__side--left" aria-hidden />
          <span className="rack-pane__side rack-pane__side--bottom" aria-hidden />
          <span className="rack-pane__flag">{settled ? 'Settled' : 'Needs you'}</span>
        </>
      )}

      <span className="rack-pane__avatar">{pane.initials}</span>
      <span className="rack-pane__name">{pane.agentName}</span>
      {pane.live && <span className="rack-pane__live">live</span>}
      <span className="rack-pane__doing">{pane.doing ?? 'No messages yet'}</span>

      {pane.mission && <span className="rack-pane__seal">{pane.mission.title}</span>}
    </button>
  );
}
