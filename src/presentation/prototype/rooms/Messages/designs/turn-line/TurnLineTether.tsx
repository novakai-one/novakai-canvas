/**
 * The one line on the field, and it says what it is.
 *
 * When a referenced object is revealed, a single dashed tether runs from the block you
 * opened to the context now showing, captioned with the relation it carries. There is
 * never more than one, and it draws nothing when either end is off screen — a wire that
 * cannot be read is decoration.
 */
import { useLayoutEffect, useState } from 'react';

type Segment = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
};

function measure(markerId: string): Segment | null {
  const marker = document.querySelector<HTMLElement>(`[data-marker-id="${CSS.escape(markerId)}"]`);
  const anchor = document.querySelector<HTMLElement>('[data-tether-anchor="bloom"]');
  if (!marker || !anchor) return null;
  const from = marker.getBoundingClientRect();
  const to = anchor.getBoundingClientRect();
  const reader = document.querySelector<HTMLElement>('.tl-reader');
  // A block sitting under the reader has no visible end to draw to, and a line that
  // disappears behind a panel reads as a rendering fault rather than a relationship.
  if (reader && from.right > reader.getBoundingClientRect().left) return null;
  return {
    x1: from.left + from.width / 2,
    y1: from.top + from.height / 2,
    x2: to.left,
    y2: to.top + Math.min(to.height / 2, 28),
  };
}

export function TurnLineTether({ markerId, caption }: { markerId: string; caption: string }) {
  const [segment, setSegment] = useState<Segment | null>(null);

  useLayoutEffect(() => {
    const update = () => setSegment(measure(markerId));
    // One frame later, so the bloom that triggered this has been laid out.
    const frame = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
    };
  }, [markerId, caption]);

  if (!segment) return null;

  const midX = (segment.x1 + segment.x2) / 2;
  const midY = (segment.y1 + segment.y2) / 2;

  return (
    <svg className="tl-tether" aria-hidden="true">
      <line x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2} />
      <circle cx={segment.x1} cy={segment.y1} r={3} />
      <text x={midX} y={midY - 8} textAnchor="middle">
        {caption}
      </text>
    </svg>
  );
}
