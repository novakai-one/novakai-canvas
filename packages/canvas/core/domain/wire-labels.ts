/** What a wire says: the one label decision every rendering host shares. */

import type { WireId } from '../../contract/brands.ts';
import type { CanvasWire, FlowStep } from '../../contract/records/index.ts';

/**
 * What one wire says right now: its structural label, or — while a flow is
 * active — the steps riding it. A wire never says both; a focal wire's
 * steps replace its label, and a wire the flow does not ride says nothing
 * (wireLabelOf returns undefined). Every host renders from this one value.
 */
export type WireLabel =
  | { kind: 'wire'; text: string }
  | { kind: 'step'; steps: readonly Readonly<FlowStep>[] };

/**
 * The single decision for a wire's label. No active flow → the structural
 * label. Active flow → the wire's steps, or undefined when the flow does
 * not ride it. Pass the map from stepsByWire, or undefined for no flow.
 */
export function wireLabelOf(
  wire: Pick<CanvasWire, 'id' | 'label'>,
  activeSteps: ReadonlyMap<WireId, readonly Readonly<FlowStep>[]> | undefined,
): WireLabel | undefined {
  if (!activeSteps) return { kind: 'wire', text: wire.label };
  const steps = activeSteps.get(wire.id);
  return steps ? { kind: 'step', steps } : undefined;
}

/**
 * One wire label as display text, identical in every host: the structural
 * label, or step badges — "2", "2 · save()", "2 · save()  7".
 */
export function wireLabelText(label: WireLabel | undefined): string {
  if (!label) return '';
  if (label.kind === 'wire') return label.text;
  return label.steps
    .map((step) => (step.label ? `${step.ordinal} · ${step.label}` : String(step.ordinal)))
    .join('  ');
}
