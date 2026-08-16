/**
 * One conversation, standing on the plane.
 *
 * The block is the object. Its side says who owes the turn, its distance says how long,
 * its height says how deep the exchange has gone, and its fidelity drops with distance
 * so the far half of the field stays quiet. A conversation with nothing said yet is a
 * dashed footprint: absence has a shape here, never a grey caption.
 */
import type { PlacedThread } from './turn-line-geometry';
import { formatWait } from './turn-line-model';

export type MarkerTone = 'quiet' | 'amber' | 'settled';

export function TurnLineMarker({
  placed,
  tone,
  open,
  onSelect,
}: {
  placed: PlacedThread;
  tone: MarkerTone;
  open: boolean;
  onSelect: () => void;
}) {
  const { thread, tier, side } = placed;
  const wait = formatWait(thread.waitMs);
  const holderWord = side === 'you' ? 'your move' : 'their move';
  // Distance drops fidelity, but the block that needs you is always legible: the one
  // thing you must act on can never be the one thing you cannot read.
  const named = tier !== 'days' || tone === 'amber' || tone === 'settled' || open;

  return (
    <button
      type="button"
      className="tl-marker"
      data-marker-id={thread.id}
      data-side={side}
      data-tier={tier}
      data-tone={tone}
      data-live={thread.live || undefined}
      data-ghost={thread.ghost || undefined}
      data-unread={thread.unread || undefined}
      data-open={open || undefined}
      aria-label={`${thread.name}, ${holderWord}, waiting ${wait}`}
      style={{
        left: `${placed.x}px`,
        top: `${placed.y}px`,
        '--tl-width': `${named && tier === 'days' ? 168 : placed.width}px`,
        '--tl-scale': placed.scale,
        '--tl-haze': placed.haze,
        '--tl-extrude': `${placed.extrusion}px`,
        '--tl-cast': side === 'you' ? '-1' : '1',
      } as React.CSSProperties}
      onClick={onSelect}
    >
      {tone === 'amber' && <span className="tl-marker__flag">Needs you</span>}
      <span className="tl-marker__block">
        <span className="tl-marker__mono" aria-hidden="true">
          {thread.monogram}
        </span>
        {named && <span className="tl-marker__name">{thread.name}</span>}
        <span className="tl-marker__wait">{wait}</span>
        {thread.live && <span className="tl-marker__pulse" aria-hidden="true" />}
      </span>
    </button>
  );
}
