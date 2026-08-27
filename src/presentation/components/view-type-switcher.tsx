import type { ViewTypeId } from '@novakai/canvas';
import { VIEW_TYPES } from '@novakai/canvas';

interface ViewTypeSwitcherProps {
  active: ViewTypeId;
  available: ReadonlySet<ViewTypeId>;
  onSelect: (viewTypeId: ViewTypeId) => void;
}

/** Selects one repo-owned rendering preset; the choice lives in host state, never the record. */
export function ViewTypeSwitcher({ active, available, onSelect }: ViewTypeSwitcherProps) {
  return (
    <label className="flow-switcher">
      <span>View</span>
      <select
        aria-label="View type"
        onChange={(event) => onSelect(event.target.value as ViewTypeId)}
        value={active}
      >
        {VIEW_TYPES.map(({ id, label }) => (
          <option disabled={!available.has(id)} key={id} value={id}>{label}</option>
        ))}
      </select>
    </label>
  );
}
