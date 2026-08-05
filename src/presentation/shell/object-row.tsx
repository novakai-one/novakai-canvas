/**
 * One object in a panel list, with its two distinct acts.
 *
 * The row itself peeks — it selects and leaves the workspace exactly where it is. The crosshair
 * travels. Travel is deliberately the smaller, later affordance: it is not on screen until the
 * pointer is already on the row, so nothing ever moves by accident.
 */
export function ObjectRow({
  indent = 0, kind, label, onJump, onPeek, selected = false,
}: {
  kind: string;
  label: string;
  indent?: number;
  selected?: boolean;
  onPeek: () => void;
  onJump: () => void;
}) {
  return (
    <li
      className="object-row"
      data-selected={selected || undefined}
      style={{ ['--row-indent' as string]: `${indent}px` }}
    >
      <button className="object-peek" onClick={onPeek} type="button">
        <span className="object-row-kind">{kind}</span>
        <span className="object-row-label">{label}</span>
      </button>
      <button
        aria-label={`Go to ${label}`}
        className="object-jump"
        onClick={onJump}
        title={`Go to ${label}`}
        type="button"
      >
        <span aria-hidden>⌖</span>
      </button>
    </li>
  );
}
