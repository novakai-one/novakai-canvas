import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import type { CableEdge as CableEdgeModel } from './catenary-projection';

const RELEASE_DURATION_MS = 700;
const FRAME_EPSILON = 0.4;

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/**
 * Eases a number towards its target so the cable relaxes rather than snapping.
 *
 * The bead nodes travel the same distance under a CSS transition of the same
 * duration, which is what keeps them sitting on the curve while it moves.
 */
function useEasedNumber(target: number): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (Math.abs(from - target) < FRAME_EPSILON) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / RELEASE_DURATION_MS);
      const next = from + (target - from) * easeOutCubic(progress);
      fromRef.current = next;
      setValue(next);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return value;
}

/** The cable itself: one hanging curve whose depth is how long an ask has waited. */
export function CableEdge(props: EdgeProps<CableEdgeModel>) {
  const sag = useEasedNumber(props.data?.sag ?? 0);
  const midX = (props.sourceX + props.targetX) / 2;
  const midY = (props.sourceY + props.targetY) / 2 + sag * 2;
  const path = `M ${props.sourceX} ${props.sourceY} Q ${midX} ${midY} ${props.targetX} ${props.targetY}`;
  const state = {
    'data-focused': props.data?.focused ?? false,
    'data-loaded': props.data?.loaded ?? false,
    'data-released': props.data?.released ?? false,
    'data-depth': props.data?.depth ?? 0,
  };

  return (
    <>
      <BaseEdge path={path} className="catenary-cable catenary-cable--shadow" {...state} />
      <BaseEdge path={path} className="catenary-cable catenary-cable--line" {...state} />
    </>
  );
}
