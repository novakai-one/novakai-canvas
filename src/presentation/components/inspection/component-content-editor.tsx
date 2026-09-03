import type { ContentEditorDeclaration } from '@novakai/canvas';
import type { DiagramNode as CanvasNode } from '@novakai/canvas';
import type { InspectPanelProps } from './contract';
import { ItemListContentEditor } from './item-list-content-editor';
import { RecordListContentEditor } from './record-list-content-editor';
import { StringListContentEditor } from './string-list-content-editor';

/** Exhaustive host adapter for registry-declared semantic content editors. */
export function ComponentContentEditor({ declaration, node, props }: {
  declaration: ContentEditorDeclaration;
  node: CanvasNode;
  props: InspectPanelProps;
}) {
  if (declaration.kind === 'record-list') {
    return <RecordListContentEditor declaration={declaration} node={node} props={props} />;
  }
  if (declaration.kind === 'item-list') {
    return <ItemListContentEditor declaration={declaration} node={node} props={props} />;
  }
  return <StringListContentEditor declaration={declaration} node={node} props={props} />;
}
