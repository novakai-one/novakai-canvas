import type { CompiledFlow, DiagramRecord, Selection, WireId } from '@novakai/canvas';
import { stepsOf } from '@novakai/canvas';

/** One flow step resolved against its wire and endpoints, ready to render. */
export interface FlowStepRow {
  ordinal: number;
  /** Step label, falling back to the wire's structural label. */
  label: string;
  wireId: WireId;
  /** Where the step travels, as "Source → Target". */
  path: string;
}

/**
 * Resolves one flow's steps into displayable rows, in ordinal order.
 * Undefined flow → no rows (structure mode). Pure; safe to call per render.
 */
export function flowStepRows(
  flow: CompiledFlow | undefined,
  record: DiagramRecord,
): readonly FlowStepRow[] {
  if (!flow) return [];
  return stepsOf(flow).map((step) => {
    const wire = record.wires[step.ref];
    return {
      ordinal: step.ordinal,
      label: step.label ?? wire?.label ?? '',
      wireId: step.ref,
      path: wire
        ? `${record.nodes[wire.source.nodeId]?.label ?? '?'} → ${record.nodes[wire.target.nodeId]?.label ?? '?'}`
        : '',
    };
  });
}

export interface FlowPanelProps {
  /** The active flow's rows; empty renders nothing. */
  rows: readonly FlowStepRow[];
  /** Current canvas selection, so the selected step's row reads as selected. */
  selection: Selection;
  /** Peek: selects the step's wire and leaves the camera where it is. */
  onSelectWire: (wireId: WireId) => void;
}

/**
 * Lists the active flow's steps in ordinal order: "2 · save() — Router → Store".
 * Clicking a row selects that wire on the canvas without moving the camera.
 * Shows one flow only; switching flows swaps the list.
 */
export function FlowPanel({ onSelectWire, rows, selection }: FlowPanelProps) {
  if (rows.length === 0) return null;
  const selectedWireId = selection?.kind === 'wire' ? selection.id : null;
  return (
    <ol className="flow-panel" aria-label="Flow steps">
      {rows.map((row, index) => (
        <li key={`${row.ordinal}-${index}`}>
          <button
            className={`flow-panel-step${row.wireId === selectedWireId ? ' is-selected' : ''}`}
            onClick={() => onSelectWire(row.wireId)}
            type="button"
          >
            <span className="flow-panel-ordinal">{row.ordinal}</span>
            <span className="flow-panel-text">
              <span className="flow-panel-label">{row.label}</span>
              <span className="flow-panel-path">{row.path}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
