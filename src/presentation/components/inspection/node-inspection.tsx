import { componentFor } from '../../../components/registry';
import { rootGroupId } from '../../canvas-actions';
import { FieldRow, ObjectRow, PanelSection, SwitchRow } from '../../shell';
import { ComponentContentEditor } from './component-content-editor';
import type { InspectPanelProps, Inspection } from './contract';
import { ArrangementControls, NodeAppearanceControls } from './presentation-controls';
import { inspectionSupport } from './support';

const { diagramInspection, nodeTrail, placementOf, sectionProps } = inspectionSupport;

/** Inspection and editing surface for one semantic node. */
export function nodeInspection(props: InspectPanelProps, id: string): Inspection {
  const node = props.record.nodes[id];
  if (!node) return diagramInspection(props);
  const component = componentFor(node.kind);
  const placement = placementOf(props.record, id);
  const detail = node.expandsToDiagramId
    ? props.diagrams.find((entry) => entry.id === node.expandsToDiagramId) : undefined;
  const isRoot = id === rootGroupId(props.record);
  const hasText = component.appearanceKeys?.some(
    (key) => ['icon', 'font', 'size', 'weight', 'align', 'vertical-align', 'text'].includes(key),
  ) ?? false;
  const hasBox = component.appearanceKeys?.some(
    (key) => ['background', 'border-color', 'border', 'radius', 'padding', 'badge', 'palette'].includes(key),
  ) ?? false;
  const hasInterfaces = component.allowsMembers !== false;
  const hasContent = Boolean(component.contentEditors?.length);
  const sections = [
    'description', ...(hasContent ? ['content'] : []),
    ...(hasText ? ['text'] : []), ...(hasBox ? ['box'] : []),
    ...(hasInterfaces ? ['interfaces'] : []),
    ...(component.arrangementModes?.length ? ['layout'] : []), 'placement',
  ];
  const rename = (label: string): void => {
    const commands = [{ kind: 'node.update', id, patch: { label } }] as const;
    if (isRoot && label.trim()) {
      props.executeAll([...commands, { kind: 'diagram.rename', name: label }]);
    } else props.execute(commands[0]);
  };
  return {
    kind: node.kind, title: node.label, meta: '',
    rename: props.editable ? rename : undefined,
    remove: props.editable && !isRoot ? {
      label: 'Delete object',
      run: () => { props.execute({ kind: 'node.remove', id }); props.clearSelection(); },
    } : undefined,
    trail: nodeTrail(props, id), sections,
    body: <>
      <PanelSection {...sectionProps(props, 'description')} title="Description">
        <textarea disabled={!props.editable} placeholder="What is this?"
          onChange={(event) => props.execute({
            kind: 'node.update', id, patch: { description: event.target.value },
          })} value={node.description ?? ''} />
        {node.subjectRef && <FieldRow label="Subject"><output>
          {node.subjectRef.namespace}:{node.subjectRef.id}
        </output></FieldRow>}
        {node.expandsToDiagramId && <FieldRow label="Detail diagram"><output>
          {detail?.name ?? node.expandsToDiagramId}
        </output></FieldRow>}
        {detail?.status === 'active' && <button className="panel-button"
          onClick={() => props.openDiagram(detail.id)} type="button">Open detail →</button>}
      </PanelSection>
      {hasContent && <PanelSection {...sectionProps(props, 'content')} title="Content">
        {component.contentEditors?.map((declaration) => <ComponentContentEditor
          declaration={declaration} key={declaration.field} node={node} props={props} />)}
      </PanelSection>}
      {hasText && <PanelSection {...sectionProps(props, 'text')} title="Text">
        <NodeAppearanceControls nodeId={id} props={props} text />
      </PanelSection>}
      {hasBox && <PanelSection {...sectionProps(props, 'box')} title="Box">
        <NodeAppearanceControls nodeId={id} props={props} text={false} />
      </PanelSection>}
      {hasInterfaces && <PanelSection {...sectionProps(props, 'interfaces')} title="Interfaces"
        trailing={node.interfaceIds.length
          ? <span className="rail-count">{node.interfaceIds.length}</span> : undefined}>
        {node.interfaceIds.length ? <ul className="object-list">{node.interfaceIds.map((interfaceId) => {
          const item = props.record.interfaces[interfaceId];
          return item ? <ObjectRow key={interfaceId} kind="interface"
            label={`${item.name}(${item.accepts.join(', ')})`}
            onJump={() => props.select({ kind: 'interface', id: interfaceId })}
            onPeek={() => props.select({ kind: 'interface', id: interfaceId })} /> : null;
        })}</ul> : <div className="panel-empty"><span>None yet</span></div>}
        {props.editable && props.addInterface && <button className="panel-button"
          onClick={() => props.addInterface?.(id)} type="button">+ Add interface</button>}
      </PanelSection>}
      {component.arrangementModes?.length && <PanelSection
        {...sectionProps(props, 'layout')} title="Group layout">
        <ArrangementControls nodeId={id} props={props} />
      </PanelSection>}
      <PanelSection {...sectionProps(props, 'placement')} title="Placement">
        <FieldRow label="Size"><output>
          {placement.sizeMode === 'manual' ? 'Manual' : 'Automatic'}
        </output></FieldRow>
        {placement.sizeMode === 'manual' && <button className="panel-button"
          disabled={!props.editable}
          onClick={() => props.execute({ kind: 'node.autoSize', id })}
          type="button">Use automatic size</button>}
        <SwitchRow checked={placement.pinned} disabled={!props.editable} label="Lock position"
          onChange={(pinned) => props.execute({ kind: 'node.pin', id, pinned })} />
        {node.kind === 'group' && <SwitchRow
          checked={props.view.collapsedNodeIds.includes(node.id)} disabled={!props.editable}
          label="Collapse children" onChange={(collapsed) => props.execute({
            kind: 'view.setCollapsed', id, collapsed,
          })} />}
      </PanelSection>
    </>,
  };
}
