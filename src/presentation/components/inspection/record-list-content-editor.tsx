import { useEffect, useState } from 'react';
import type {
  RecordEditorField, RecordEditorVariant, RecordListContentEditorDeclaration,
} from '@novakai/canvas';
import type { DiagramNode as CanvasNode } from '@novakai/canvas';
import type { InspectPanelProps } from './contract';
import { fieldInvalid, moveItem, type DraftRecord } from './content-editor-support';

function recordList(node: CanvasNode, field: string): DraftRecord[] {
  const value = (node as unknown as Record<string, unknown>)[field];
  return Array.isArray(value)
    ? value.filter((item): item is DraftRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function variantFor(
  declaration: RecordListContentEditorDeclaration,
  item: DraftRecord,
): RecordEditorVariant | undefined {
  if (!declaration.discriminator) return declaration.variants[0];
  const key = item[declaration.discriminator];
  return declaration.variants.find((variant) => variant.key === key);
}

function newItem(
  declaration: RecordListContentEditorDeclaration,
  variant: RecordEditorVariant,
): DraftRecord {
  return {
    ...variant.defaults,
    ...(declaration.discriminator ? { [declaration.discriminator]: variant.key } : {}),
    [declaration.identity.field]: `${declaration.identity.prefix}-${crypto.randomUUID()}`,
  };
}

function invalidDraft(
  declaration: RecordListContentEditorDeclaration,
  draft: DraftRecord[],
): boolean {
  const ids = draft.map((item) => item[declaration.identity.field]);
  if (ids.some((id) => typeof id !== 'string' || id.length === 0)) return true;
  if (new Set(ids).size !== ids.length) return true;
  return draft.some((item) => {
    const variant = variantFor(declaration, item);
    return !variant || variant.fields.some((field) => fieldInvalid(field, item[field.field]));
  });
}

function TextField({ disabled, field, item, setField }: {
  disabled: boolean;
  field: Extract<RecordEditorField, { control: 'text' }>;
  item: DraftRecord;
  setField: (value: unknown) => void;
}) {
  const candidate = item[field.field];
  const value = typeof candidate === 'string' ? candidate : '';
  return <label><span className="field-label">{field.label}</span>
    <input data-invalid={fieldInvalid(field, value) || undefined} disabled={disabled}
      maxLength={field.maxLength} onChange={(event) => setField(event.target.value)} value={value} />
  </label>;
}

function SelectField({ disabled, field, item, setField }: {
  disabled: boolean;
  field: Extract<RecordEditorField, { control: 'select' }>;
  item: DraftRecord;
  setField: (value: unknown) => void;
}) {
  const candidate = item[field.field];
  const value = typeof candidate === 'string' ? candidate : '';
  return <label><span className="field-label">{field.label}</span>
    <select disabled={disabled} onChange={(event) => setField(event.target.value)} value={value}>
      {!field.required && <option value="">None</option>}
      {field.values.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
    </select>
  </label>;
}

function MultiSelectField({ disabled, field, item, setField }: {
  disabled: boolean;
  field: Extract<RecordEditorField, { control: 'multi-select' }>;
  item: DraftRecord;
  setField: (value: unknown) => void;
}) {
  const candidate = item[field.field];
  const selected = Array.isArray(candidate)
    ? candidate.filter((value: unknown): value is string => typeof value === 'string') : [];
  return <fieldset className="content-editor-options">
    <legend className="field-label">{field.label}</legend>
    {field.values.map((choice) => <label key={choice}>
      <input checked={selected.includes(choice)} disabled={disabled} type="checkbox"
        onChange={(event) => setField(event.target.checked
          ? field.values.filter((value) => [...selected, choice].includes(value))
          : selected.filter((value) => value !== choice))} />
      <span>{choice}</span>
    </label>)}
  </fieldset>;
}

/** Shared by every collection editor: renders one declared field with the right control. */
export function RecordField({ disabled, field, item, setField }: {
  disabled: boolean; field: RecordEditorField; item: DraftRecord;
  setField: (value: unknown) => void;
}) {
  if (field.control === 'text') {
    return <TextField disabled={disabled} field={field} item={item} setField={setField} />;
  }
  if (field.control === 'select') {
    return <SelectField disabled={disabled} field={field} item={item} setField={setField} />;
  }
  return <MultiSelectField disabled={disabled} field={field} item={item} setField={setField} />;
}

/** Generic draft editor for any registry-declared structured collection. */
export function RecordListContentEditor({ declaration, node, props }: {
  declaration: RecordListContentEditorDeclaration;
  node: CanvasNode;
  props: InspectPanelProps;
}) {
  const persisted = recordList(node, declaration.field);
  const persistedKey = JSON.stringify(persisted);
  const [draft, setDraft] = useState<DraftRecord[]>(persisted);
  useEffect(() => setDraft(JSON.parse(persistedKey) as DraftRecord[]), [
    declaration.field, node.id, persistedKey,
  ]);
  const dirty = JSON.stringify(draft) !== persistedKey;
  const invalid = invalidDraft(declaration, draft);
  const update = (index: number, patch: DraftRecord): void => {
    setDraft(draft.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };
  const changeVariant = (index: number, variant: RecordEditorVariant): void => {
    const current = draft[index];
    if (!current) return;
    const id = current[declaration.identity.field];
    setDraft(draft.map((item, itemIndex) => itemIndex === index ? {
      ...variant.defaults,
      ...(declaration.discriminator ? { [declaration.discriminator]: variant.key } : {}),
      [declaration.identity.field]: id,
    } : item));
  };
  const save = (): void => {
    props.execute({ kind: 'node.content.set', id: node.id, field: declaration.field, value: draft });
    const selection = props.selection;
    if (selection?.kind === 'component-item' && selection.nodeId === node.id
      && selection.collection === declaration.field
      && !draft.some((item) => item[declaration.identity.field] === selection.itemId)) {
      props.select({ kind: 'node', id: node.id });
    }
  };

  return <div aria-label={declaration.label} className="component-content-editor">
    {draft.map((item, index) => {
      const variant = variantFor(declaration, item) ?? declaration.variants[0];
      return <div className="content-editor-row" key={String(item[declaration.identity.field] ?? index)}>
        {declaration.discriminator && declaration.variants.length > 1 && <label>
          <span className="field-label">Type</span>
          <select disabled={!props.editable} value={variant.key}
            onChange={(event) => changeVariant(index,
              declaration.variants.find((candidate) => candidate.key === event.target.value)
                ?? declaration.variants[0])}>
            {declaration.variants.map((choice) => <option key={choice.key} value={choice.key}>
              {choice.label}
            </option>)}
          </select>
        </label>}
        {variant.fields.map((field) => <RecordField disabled={!props.editable} field={field}
          item={item} key={field.field} setField={(value) => update(index, { [field.field]: value })} />)}
        <div className="content-editor-row-actions">
          <button aria-label={`Move ${declaration.itemLabel} ${index + 1} up`}
            disabled={!props.editable || index === 0}
            onClick={() => setDraft(moveItem(draft, index, -1))} type="button">↑</button>
          <button aria-label={`Move ${declaration.itemLabel} ${index + 1} down`}
            disabled={!props.editable || index === draft.length - 1}
            onClick={() => setDraft(moveItem(draft, index, 1))} type="button">↓</button>
          <button disabled={!props.editable}
            onClick={() => setDraft(draft.filter((_, itemIndex) => itemIndex !== index))}
            type="button">Remove</button>
        </div>
      </div>;
    })}
    {!draft.length && <div className="panel-empty"><span>No items yet</span></div>}
    <div className="content-editor-actions">
      {declaration.variants.map((variant) => <button className="panel-button"
        disabled={!props.editable} key={variant.key}
        onClick={() => setDraft([...draft, newItem(declaration, variant)])} type="button">
        + Add {declaration.variants.length > 1 ? variant.label : declaration.itemLabel}
      </button>)}
      <button className="panel-button" disabled={!props.editable || !dirty}
        onClick={() => setDraft(persisted)} type="button">Cancel</button>
      <button className="panel-button" disabled={!props.editable || !dirty || invalid}
        onClick={save} type="button">Save</button>
    </div>
  </div>;
}
