import { useEffect, useState } from 'react';
import type { StringListContentEditorDeclaration } from '../../../components/component';
import type { CanvasNode } from '../../../domain/records';
import type { InspectPanelProps } from './contract';

function stringList(node: CanvasNode, field: string): string[] {
  const value = (node as unknown as Record<string, unknown>)[field];
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}

function moveItem(items: string[], index: number, offset: -1 | 1): string[] {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Draft editor for one registry-declared semantic string collection. */
export function StringListContentEditor({ declaration, node, props }: {
  declaration: StringListContentEditorDeclaration;
  node: CanvasNode;
  props: InspectPanelProps;
}) {
  const persisted = stringList(node, declaration.field);
  const persistedKey = JSON.stringify(persisted);
  const [draft, setDraft] = useState<string[]>(persisted);
  useEffect(() => setDraft(JSON.parse(persistedKey) as string[]), [
    declaration.field, node.id, persistedKey,
  ]);
  const dirty = JSON.stringify(draft) !== persistedKey;
  const invalid = draft.some((line) => line.length === 0);
  const update = (index: number, value: string): void => {
    setDraft(draft.map((line, itemIndex) => itemIndex === index ? value : line));
  };

  return <div aria-label={declaration.label} className="component-content-editor">
    {draft.map((line, index) => <div className="content-editor-row" key={index}>
      <label>
        <span className="field-label">{declaration.itemLabel} {index + 1}</span>
        <input data-invalid={line.length === 0 || undefined} disabled={!props.editable}
          onChange={(event) => update(index, event.target.value)} value={line} />
      </label>
      <div className="content-editor-row-actions">
        <button aria-label={`Move ${declaration.itemLabel} ${index + 1} up`}
          disabled={!props.editable || index === 0}
          onClick={() => setDraft(moveItem(draft, index, -1))} type="button">↑</button>
        <button aria-label={`Move ${declaration.itemLabel} ${index + 1} down`}
          disabled={!props.editable || index === draft.length - 1}
          onClick={() => setDraft(moveItem(draft, index, 1))} type="button">↓</button>
        <button aria-label={`Remove ${declaration.itemLabel} ${index + 1}`}
          disabled={!props.editable}
          onClick={() => setDraft(draft.filter((_, itemIndex) => itemIndex !== index))}
          type="button">Remove</button>
      </div>
    </div>)}
    {!draft.length && <div className="panel-empty"><span>No content lines</span></div>}
    <div className="content-editor-actions">
      <button className="panel-button" disabled={!props.editable}
        onClick={() => setDraft([...draft, ''])} type="button">+ Add line</button>
      <button className="panel-button" disabled={!props.editable || !dirty}
        onClick={() => setDraft(persisted)} type="button">Cancel</button>
      <button className="panel-button" disabled={!props.editable || !dirty || invalid}
        onClick={() => props.execute({
          kind: 'node.content.set', id: node.id, field: declaration.field, value: draft,
        })} type="button">Save</button>
    </div>
  </div>;
}
