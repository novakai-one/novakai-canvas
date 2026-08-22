import { FieldRow, ObjectRow, PanelSection } from '../../shell';
import type { InspectPanelProps, Inspection } from './contract';
import { WireAppearanceControls } from './presentation-controls';
import { inspectionSupport } from './support';

const { diagramInspection, sectionProps } = inspectionSupport;

const WIRE_KINDS = ['owns', 'references', 'queries', 'executes', 'assigns', 'mentions'] as const;

/** Semantic relationship and layout-specific styling for one wire. */
export function wireInspection(props: InspectPanelProps, id: string): Inspection {
  const wire = props.record.wires[id];
  if (!wire) return diagramInspection(props);
  const endpoint = (nodeId: string) => ({
    id: nodeId,
    label: props.record.nodes[nodeId]?.label ?? nodeId,
    kind: props.record.nodes[nodeId]?.kind ?? 'missing',
  });
  const ends = [endpoint(wire.source.nodeId), endpoint(wire.target.nodeId)];
  const layout = inspectionSupport.activeLayout(props.record);
  const hint = layout?.wireRouteHints[id];
  const manual = Boolean(hint?.waypoints.length
    || hint?.preferredSourceSide || hint?.preferredTargetSide);
  return {
    kind: 'Wire', title: wire.label || 'Unlabelled', meta: '',
    remove: props.editable ? {
      label: 'Delete wire',
      run: () => { props.execute({ kind: 'wire.remove', id }); props.clearSelection(); },
    } : undefined,
    sections: ['relationship', 'endpoints', 'style', 'routing'],
    trail: [
      { label: props.record.name, select: null },
      { label: wire.label || 'Unlabelled', select: { kind: 'wire', id } },
    ],
    body: <>
      <PanelSection {...sectionProps(props, 'relationship')} title="Relationship">
        <FieldRow label="Label"><input disabled={!props.editable}
          onChange={(event) => props.execute({
            kind: 'wire.update', id, patch: { label: event.target.value },
          })} value={wire.label ?? ''} /></FieldRow>
        <FieldRow label="Kind"><select disabled={!props.editable} value={wire.kind}
          onChange={(event) => props.execute({
            kind: 'wire.update', id,
            patch: { kind: event.target.value as typeof WIRE_KINDS[number] },
          })}>
          {WIRE_KINDS.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
          {!WIRE_KINDS.includes(wire.kind as typeof WIRE_KINDS[number])
            && <option value={wire.kind}>{wire.kind}</option>}
        </select></FieldRow>
      </PanelSection>
      <PanelSection {...sectionProps(props, 'endpoints')} title="Endpoints">
        <ul className="object-list">{ends.map((end, index) => <ObjectRow
          key={`${end.id}-${index}`} kind={index ? 'to' : 'from'} label={end.label}
          onJump={() => (props.jumpTo ?? props.select)({ kind: 'node', id: end.id })}
          onPeek={() => props.select({ kind: 'node', id: end.id })} />)}</ul>
      </PanelSection>
      <PanelSection {...sectionProps(props, 'style')} title="Style">
        <WireAppearanceControls props={props} wireId={id} />
      </PanelSection>
      <PanelSection {...sectionProps(props, 'routing')} title="Routing">
        <FieldRow label="Mode"><output>{manual ? 'Manual' : 'Automatic'}</output></FieldRow>
        {manual && props.editable && <button className="panel-button" onClick={() => props.execute({
          kind: 'wire.setRoute', id,
          route: {
            waypoints: [], preferredSourceSide: null, preferredTargetSide: null,
          },
        })} type="button">Use automatic route</button>}
      </PanelSection>
    </>,
  };
}
