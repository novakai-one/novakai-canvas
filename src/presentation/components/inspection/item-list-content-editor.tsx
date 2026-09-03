import { useEffect, useState } from 'react';
import type { ItemListContentEditorDeclaration } from '@novakai/canvas';
import type { DiagramNode as CanvasNode } from '@novakai/canvas';
import type { InspectPanelProps } from './contract';
import { fieldInvalid, moveItem, type DraftRecord } from './content-editor-support';
import { RecordField } from './record-list-content-editor';

/**
 * Draft editor for a position-addressed collection: rows are keyed by index and saving writes
 * the items verbatim. Nothing here mints identity — that is the whole difference from the
 * record-list editor, whose rows carry stored ids.
 */

function itemList(node: CanvasNode, field: string): DraftRecord[] {
  const value = (node as unknown as Record<string, unknown>)[field];
  return Array.isArray(value)
    ? value.filter((item): item is DraftRecord =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function invalidDraft(declaration: ItemListContentEditorDeclaration, draft: DraftRecord[]): boolean {
  if (draft.length === 0 || draft.length > declaration.maxItems) return true;
  return draft.some((item) =>
    declaration.fields.some((field) => fieldInvalid(field, item[field.field])));
}

export function ItemListContentEditor({ declaration, node, props }: {
  declaration: ItemListContentEditorDeclaration;
  node: CanvasNode;
  props: InspectPanelProps;
}) {
  const persisted = itemList(node, declaration.field);
  const persistedKey = JSON.stringify(persisted);
  const [draft, setDraft] = useState<DraftRecord[]>(persisted);
  useEffect(() => setDraft(JSON.parse(persistedKey) as DraftRecord[]), [
    declaration.field, node.id, persistedKey,
  ]);
  const dirty = JSON.stringify(draft) !== persistedKey;
  const update = (index: number, patch: DraftRecord): void => {
    setDraft(draft.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  return <div aria-label={declaration.label} className="component-content-editor">
    {draft.map((item, index) => (
      <div className="content-editor-row" key={index}>
        {declaration.fields.map((field) => <RecordField disabled={!props.editable} field={field}
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
      </div>
    ))}
    {!draft.length && <div className="panel-empty"><span>No items yet</span></div>}
    <div className="content-editor-actions">
      <button className="panel-button"
        disabled={!props.editable || draft.length >= declaration.maxItems}
        onClick={() => setDraft([...draft, { ...declaration.defaults }])} type="button">
        + Add {declaration.itemLabel}
      </button>
      <button className="panel-button" disabled={!props.editable || !dirty}
        onClick={() => setDraft(persisted)} type="button">Cancel</button>
      <button className="panel-button"
        disabled={!props.editable || !dirty || invalidDraft(declaration, draft)}
        onClick={() => props.execute({
          kind: 'node.content.set', id: node.id, field: declaration.field, value: draft,
        })} type="button">Save</button>
    </div>
  </div>;
}
