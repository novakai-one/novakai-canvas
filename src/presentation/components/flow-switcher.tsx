import type { FlowId } from '../../domain/ids.ts';
import type { FlowLibrary } from '../../domain/flows.ts';

interface FlowSwitcherProps {
  flows: FlowLibrary;
  activeFlowId?: FlowId;
  onSelect: (flowId: FlowId | undefined) => void;
}

/** Selects one reading overlay; geometry and flow compilation remain outside this adapter. */
export function FlowSwitcher({ flows, activeFlowId, onSelect }: FlowSwitcherProps) {
  if (flows.size === 0) return null;
  return (
    <label className="flow-switcher">
      <span>Flow</span>
      <select
        aria-label="Active flow"
        onChange={(event) => onSelect(event.target.value ? event.target.value as FlowId : undefined)}
        value={activeFlowId ?? ''}
      >
        <option value="">Structure only</option>
        {[...flows].map(([id, flow]) => <option key={id} value={id}>{flow.name}</option>)}
      </select>
    </label>
  );
}
