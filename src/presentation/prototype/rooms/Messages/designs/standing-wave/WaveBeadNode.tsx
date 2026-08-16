/**
 * One message of the open conversation, parked at its own moment.
 *
 * A bead occasionally has to slide sideways so two close messages stay readable, so it
 * always draws a stem back to its true position on the clock. The card can move; the
 * moment it points at cannot.
 */
import type { NodeProps } from '@xyflow/react';
import { KIND_LABEL } from '../../../../object-graph/contract';
import type { WaveBeadNodeType } from './standing-wave-projection';

function clockLabel(isoTime: string): string {
  const parsed = new Date(isoTime);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(11, 16);
}

/** The leader line pointing from a nudged card back to the moment it belongs to. */
function MomentStem({ offsetX, mine }: { offsetX: number; mine: boolean }) {
  return (
    <span
      className="wave-bead__stem"
      data-mine={mine}
      style={{ left: `${offsetX}px` }}
      aria-hidden="true"
    />
  );
}

/** A single message on the hero lane. */
export function WaveBeadNode({ data, selected }: NodeProps<WaveBeadNodeType>) {
  const { mine, time, body, references, isOwing, stemOffsetX } = data;
  const leadReference = references[0];

  return (
    <article
      className="wave-bead"
      data-mine={mine}
      data-owing={isOwing}
      data-selected={selected}
    >
      <header className="wave-bead__meta">
        <span className="wave-bead__time">{clockLabel(time)}</span>
        {leadReference && (
          <span className="wave-bead__ref">{KIND_LABEL[leadReference.kind]}</span>
        )}
      </header>
      <p className="wave-bead__body">{body}</p>
      <MomentStem offsetX={stemOffsetX} mine={mine} />
    </article>
  );
}
