import { componentFor } from '../../../components/registry';
import {
  APPEARANCE_SPECIFICATIONS, CONTAINER_ALIGNS, GRID_COLUMNS, SPACINGS,
  type AppearanceSpecification,
  type AuthoredArrangement, type GridColumns, type NodeAppearance, type Spacing,
} from '../../../domain/canvas-presentation';
import type { DiagramRecord } from '../../../domain/records';
import {
  WIRE_APPEARANCE_SPECIFICATIONS, type WireAppearance,
} from '../../../domain/wire-appearance';
import { FieldRow } from '../../shell';
import type { InspectPanelProps } from './contract';
import { inspectionSupport } from './support';

const TEXT_KEYS = new Set(['icon', 'font', 'size', 'weight', 'align', 'text']);
const LABELS: Record<string, string> = {
  icon: 'Icon', font: 'Font', size: 'Font size', weight: 'Weight', align: 'Alignment',
  text: 'Text colour', background: 'Background', 'border-color': 'Border colour',
  border: 'Border width', radius: 'Corner radius', padding: 'Padding', badge: 'Kind badge',
  width: 'Width', pattern: 'Pattern', color: 'Colour', gap: 'Gap', columns: 'Columns',
};

function SelectValue({ disabled, label, onChange, value, values }: {
  disabled: boolean; label: string; value: string; values: readonly (string | number)[];
  onChange: (value: string) => void;
}) {
  return (
    <FieldRow label={label}>
      <select disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Default</option>
        {values.map((choice) => <option key={String(choice)} value={String(choice)}>{choice}</option>)}
      </select>
    </FieldRow>
  );
}

function specsFor(record: DiagramRecord, nodeId: string, text: boolean) {
  const allowed = componentFor(record.nodes[nodeId].kind).appearanceKeys ?? [];
  return APPEARANCE_SPECIFICATIONS.filter((spec) =>
    allowed.includes(spec.key) && TEXT_KEYS.has(spec.key) === text);
}

/** Registry-filtered node appearance controls; omitted values mean component defaults. */
export function NodeAppearanceControls({ nodeId, props, text }: {
  nodeId: string; props: InspectPanelProps; text: boolean;
}) {
  const layout = inspectionSupport.activeLayout(props.record);
  const appearance = layout?.appearanceByNodeId?.[nodeId] ?? {};
  const setValue = (spec: AppearanceSpecification, raw: string): void => {
    const next: NodeAppearance = { ...appearance };
    if (!raw) delete (next as Record<string, unknown>)[spec.jsonKey];
    else (next as Record<string, unknown>)[spec.jsonKey] = spec.values.find(
      (candidate) => String(candidate) === raw,
    );
    props.execute({ kind: 'layout.nodeAppearance.set', id: nodeId, appearance: next });
  };
  return <>{specsFor(props.record, nodeId, text).map((spec) => (
    <SelectValue disabled={!props.editable} key={spec.key} label={LABELS[spec.key] ?? spec.key}
      onChange={(value) => setValue(spec, value)}
      value={String(appearance[spec.jsonKey] ?? '')} values={spec.values} />
  ))}</>;
}

/** Group arrangement controls compiled by the workspace with direct child identities. */
export function ArrangementControls({ nodeId, props }: {
  nodeId: string; props: InspectPanelProps;
}) {
  const component = componentFor(props.record.nodes[nodeId].kind);
  if (!component.arrangementModes?.length) return null;
  const stored = inspectionSupport.activeLayout(props.record)?.arrangementByContainerId?.[nodeId];
  const authored = stored && {
    layout: stored.layout, gap: stored.gap, align: stored.align, columns: stored.columns,
  };
  const update = (patch: Partial<AuthoredArrangement>): void => {
    const layout = patch.layout ?? authored?.layout ?? 'stack';
    const next: AuthoredArrangement = {
      layout,
      gap: patch.gap ?? authored?.gap ?? 16,
      align: patch.align ?? authored?.align ?? 'stretch',
      ...(layout === 'grid' ? { columns: patch.columns ?? authored?.columns ?? 2 } : {}),
    };
    props.execute({ kind: 'layout.arrangement.set', id: nodeId, arrangement: next });
  };
  return (
    <>
      <FieldRow label="Layout">
        <select disabled={!props.editable} value={authored?.layout ?? ''} onChange={(event) => {
          if (!event.target.value) props.execute({ kind: 'layout.arrangement.set', id: nodeId });
          else update({ layout: event.target.value as AuthoredArrangement['layout'] });
        }}>
          <option value="">Manual</option>
          {component.arrangementModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
        </select>
      </FieldRow>
      {authored && <>
        <SelectValue disabled={!props.editable} label="Gap" values={SPACINGS}
          value={String(authored.gap)}
          onChange={(value) => update({ gap: (value ? Number(value) : 16) as Spacing })} />
        <SelectValue disabled={!props.editable} label="Alignment"
          values={CONTAINER_ALIGNS} value={authored.align}
          onChange={(value) => update({
            align: (value || 'stretch') as AuthoredArrangement['align'],
          })} />
        {authored.layout === 'grid' && <SelectValue disabled={!props.editable} label="Columns"
          values={GRID_COLUMNS} value={String(authored.columns ?? 2)}
          onChange={(value) => update({
            columns: (value ? Number(value) : 2) as GridColumns,
          })} />}
      </>}
    </>
  );
}

/** Closed wire presentation controls backed by the domain specifications. */
export function WireAppearanceControls({ props, wireId }: {
  props: InspectPanelProps; wireId: string;
}) {
  const appearance = inspectionSupport.activeLayout(props.record)?.appearanceByWireId?.[wireId] ?? {};
  const update = (key: string, raw: string): void => {
    const next = { ...appearance } as WireAppearance & Record<string, unknown>;
    if (raw) next[key] = raw;
    else delete next[key];
    props.execute({ kind: 'layout.wireAppearance.set', id: wireId, appearance: next });
  };
  return <>{WIRE_APPEARANCE_SPECIFICATIONS.map((spec) => (
    <SelectValue disabled={!props.editable} key={spec.key} label={LABELS[spec.key]}
      onChange={(value) => update(spec.key, value)} value={String(appearance[spec.key] ?? '')}
      values={spec.values} />
  ))}</>;
}
