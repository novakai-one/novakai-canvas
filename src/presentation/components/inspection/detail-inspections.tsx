import { componentFor } from '../../../components/registry';
import { FieldRow, ObjectRow, PanelSection } from '../../shell';
import type { InspectPanelProps, Inspection } from './contract';
import { SignatureInput } from './signature-input';
import { inspectionSupport } from './support';

const { diagramInspection, nodeTrail, sectionProps, splitTypes, typeNamed } = inspectionSupport;

export function interfaceInspection(props: InspectPanelProps, id: string): Inspection {
  const item = props.record.interfaces[id];
  if (!item) return diagramInspection(props);
  const owner = props.record.nodes[item.ownerId];
  const signature = [
    ...item.accepts.map((name) => ({ role: 'accepts', name })),
    ...item.returns.map((name) => ({ role: 'returns', name })),
  ];
  return {
    kind: 'Interface', title: item.name, meta: '',
    remove: props.editable ? {
      label: 'Delete interface',
      run: () => {
        props.execute({ kind: 'interface.remove', id });
        props.select({ kind: 'node', id: item.ownerId });
      },
    } : undefined,
    sections: ['signature', 'owner', 'types'],
    trail: [...nodeTrail(props, item.ownerId as string), {
      label: item.name, select: { kind: 'interface', id },
    }],
    body: <>
      <PanelSection {...sectionProps(props, 'signature')} title="Signature">
        <FieldRow hint="identifier" label="Name"><SignatureInput disabled={!props.editable}
          onCommit={(name) => props.execute({ kind: 'interface.update', id, patch: { name } })}
          value={item.name} /></FieldRow>
        <FieldRow hint="comma separated types" label="Accepts">
          <SignatureInput disabled={!props.editable} list value={item.accepts.join(', ')}
            onCommit={(next) => props.execute({
              kind: 'interface.update', id, patch: { accepts: splitTypes(next) },
            })} />
        </FieldRow>
        <FieldRow hint="comma separated types" label="Returns">
          <SignatureInput disabled={!props.editable} list value={item.returns.join(', ')}
            onCommit={(next) => props.execute({
              kind: 'interface.update', id, patch: { returns: splitTypes(next) },
            })} />
        </FieldRow>
      </PanelSection>
      <PanelSection {...sectionProps(props, 'owner')} title="Owner">
        <ul className="object-list"><ObjectRow kind={owner?.kind ?? 'missing'}
          label={owner?.label ?? item.ownerId}
          onJump={() => (props.jumpTo ?? props.select)({ kind: 'node', id: item.ownerId })}
          onPeek={() => props.select({ kind: 'node', id: item.ownerId })} /></ul>
      </PanelSection>
      <PanelSection {...sectionProps(props, 'types')} title="Types">
        {!signature.length ? <FieldRow label="Signature"><output>
          Takes nothing, returns void
        </output></FieldRow> : <ul className="object-list">{signature.map((entry, index) => {
          const type = typeNamed(props.record, entry.name);
          return type ? <ObjectRow key={`${entry.role}-${entry.name}-${index}`} kind={entry.role}
            label={entry.name}
            onJump={() => (props.jumpTo ?? props.select)({ kind: 'type', id: type.id })}
            onPeek={() => props.select({ kind: 'type', id: type.id })} />
            : <li className="object-row is-plain" key={`${entry.role}-${entry.name}-${index}`}>
              <span className="object-row-kind">{entry.role}</span>
              <span className="object-row-label">{entry.name}</span>
            </li>;
        })}</ul>}
      </PanelSection>
    </>,
  };
}

export function typeInspection(props: InspectPanelProps, id: string): Inspection {
  const item = props.record.types[id];
  if (!item) return diagramInspection(props);
  const usedBy = Object.values(props.record.nodes).filter((node) =>
    (node.typeIds as string[]).includes(id));
  return {
    kind: 'Type', title: item.name, meta: '', sections: ['shape'],
    trail: [{ label: props.record.name, select: null }, {
      label: item.name, select: { kind: 'type', id },
    }],
    body: <PanelSection {...sectionProps(props, 'shape')} title="Shape">
      <div className="token-row">{item.fields.map((field) => <span key={field}>{field}</span>)}</div>
      <FieldRow label="Used by"><output>
        {usedBy.map((node) => node.label).join(', ') || 'Nothing yet'}
      </output></FieldRow>
    </PanelSection>,
  };
}

export function componentItemInspection(
  props: InspectPanelProps, nodeId: string, collection: string, itemId: string,
): Inspection {
  const node = props.record.nodes[nodeId];
  const item = node && componentFor(node.kind).items?.(node).find(
    (candidate) => candidate.collection === collection && candidate.id === itemId,
  );
  if (!node || !item) return diagramInspection(props);
  return {
    kind: item.kind, title: item.label, meta: '', sections: ['details'],
    trail: [...nodeTrail(props, nodeId), {
      label: item.label, select: { kind: 'component-item', nodeId, collection, itemId },
    }],
    body: <PanelSection {...sectionProps(props, 'details')} title="Details">
      {item.fields.map((field) => <FieldRow key={field.label} label={field.label}>
        <output>{field.value}</output>
      </FieldRow>)}
    </PanelSection>,
  };
}
