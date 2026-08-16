/**
 * Contextual disclosure on the corridor wall. A revealed object gets a flat panel in
 * the room and the design's single connector: one dashed tether from the chip that
 * summoned it, captioned with the relationship it crosses. Open is the only way out.
 */
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';

export type Reveal = {
  readonly record: ObjectRecord;
  /** The relationship the tether crosses, e.g. 'referenced here'. */
  readonly caption: string;
  /** Chip midpoint in room coordinates. */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly room: { readonly width: number; readonly height: number };
};

const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 230;
const DOCK_WIDTH = 380;

export function WallInspector({
  reveal,
  canOpen,
  onOpen,
  onClose,
}: {
  reveal: Reveal;
  canOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { record, caption, anchor, room } = reveal;
  const preview =
    field(record, 'claim') ||
    field(record, 'question') ||
    field(record, 'blockedReason') ||
    field(record, 'summary') ||
    field(record, 'body');
  const status = field(record, 'status');

  const panelRight = DOCK_WIDTH + 36;
  const panelTop = Math.min(Math.max(anchor.y - PANEL_HEIGHT / 2, 20), room.height - PANEL_HEIGHT - 20);
  const tetherEnd = { x: room.width - panelRight, y: panelTop + PANEL_HEIGHT / 2 };
  const midX = (anchor.x + tetherEnd.x) / 2;
  const midY = (anchor.y + tetherEnd.y) / 2;

  return (
    <>
      <svg className="rack-tether" aria-hidden>
        <line x1={anchor.x} y1={anchor.y} x2={tetherEnd.x} y2={tetherEnd.y} />
        <text x={midX} y={midY - 8}>
          {caption}
        </text>
      </svg>

      <div
        className="rack-wall"
        role="dialog"
        aria-label={`${KIND_LABEL[record.kind]} context`}
        style={{ right: panelRight, top: panelTop, width: PANEL_WIDTH }}
      >
        <span className="rack-wall__kind">
          {KIND_LABEL[record.kind]}
          {status && <em className="rack-wall__status"> · {status}</em>}
        </span>
        <span className="rack-wall__title">{record.title}</span>
        {preview && <p className="rack-wall__preview">{preview}</p>}
        <div className="rack-wall__actions">
          {canOpen && (
            <button type="button" className="rack-wall__open" onClick={onOpen}>
              Open {KIND_LABEL[record.kind]} ↗
            </button>
          )}
          <button type="button" className="rack-wall__close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
