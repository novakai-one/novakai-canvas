import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { HeroFlowNode } from './vigil-projection';

/**
 * You, at the centre of the floor.
 *
 * The ring is the one large object on the canvas and the only place a count is
 * written out. When something is waiting the count carries the single gold accent;
 * when nothing is, the ring reads settled in sage and the floor goes quiet.
 */
export function VigilHeroRing({ data }: NodeProps<HeroFlowNode>) {
  const waiting = data.waitingCount > 0;

  return (
    <div className="vigil-hero" data-waiting={waiting}>
      <Handle type="target" position={Position.Top} className="vigil-hero__handle" />
      <span className="vigil-hero__eyebrow">Vigil</span>
      <strong className="vigil-hero__name">Chris</strong>
      <span className="vigil-hero__live">{data.liveCount} conversations</span>
      {waiting ? (
        <button
          type="button"
          className="vigil-hero__waiting"
          onClick={data.onFollowAttention}
          disabled={!data.hasAttention}
        >
          <em>{data.waitingCount}</em> waiting
        </button>
      ) : (
        <span className="vigil-hero__settled">Settled</span>
      )}
      <Handle type="source" position={Position.Bottom} className="vigil-hero__handle" />
    </div>
  );
}
