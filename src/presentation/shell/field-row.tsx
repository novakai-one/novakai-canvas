import type { ReactNode } from 'react';

/**
 * Label above control, one rhythm, every time.
 *
 * Read-only facts and editable fields share this row deliberately: an inspector that changes its
 * layout depending on whether a value happens to be editable is the inconsistency being fixed.
 */
export function FieldRow({
  children, hint, label,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field-row">
      <span className="field-line">
        <span className="field-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Label left, control right — for a boolean, where a stacked label wastes a line. */
export function SwitchRow({
  checked, disabled, label, onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="switch-row">
      <span className="field-label">{label}</span>
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}
