import {
  WIRE_CARDINALITIES, WIRE_CARDINALITY_LABELS, type WireCardinality,
} from '../../../domain/wire-cardinality';
import { FieldRow } from '../../shell';

/** One endpoint's optional semantic cardinality selector. */
export function WireCardinalityControl({
  disabled, label, value, update,
}: {
  disabled: boolean;
  label: string;
  value?: WireCardinality;
  update: (value: WireCardinality | null) => void;
}) {
  return <FieldRow label={label}><select disabled={disabled} value={value ?? ''}
    onChange={(event) => update((event.target.value || null) as WireCardinality | null)}>
    <option value="">None — directional arrow</option>
    {WIRE_CARDINALITIES.map((choice) => <option key={choice} value={choice}>
      {WIRE_CARDINALITY_LABELS[choice]}
    </option>)}
  </select></FieldRow>;
}
