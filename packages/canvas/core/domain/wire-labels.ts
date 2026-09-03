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

/** When a wire's structural label is drawn. Step badges ignore this: they are the flow. */
export interface WireLabelVisibility {
  preference: 'always' | 'selected' | 'never';
  /** The wire is selected, or touches the selection. Hosts without selection pass false. */
  focused: boolean;
}

/**
 * The single decision for a wire's label, for every host. Active flow → the
 * wire's steps, or undefined when the flow does not ride it. No active flow →
 * the structural label when the visibility rule lets this wire speak.
 * Pass the map from stepsByWire, or undefined for no flow.
 */
export function wireLabelOf(
  wire: Pick<CanvasWire, 'id' | 'label'>,
  activeSteps: ReadonlyMap<WireId, readonly Readonly<FlowStep>[]> | undefined,
  visibility: WireLabelVisibility,
): WireLabel | undefined {
  if (activeSteps) {
    const steps = activeSteps.get(wire.id);
    return steps ? { kind: 'step', steps } : undefined;
  }
  if (visibility.preference === 'never') return undefined;
  if (visibility.preference === 'selected' && !visibility.focused) return undefined;
  return { kind: 'wire', text: wire.label };
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
