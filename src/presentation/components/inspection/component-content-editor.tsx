import type { ContentEditorDeclaration } from '../../../components/component';
import type { CanvasNode } from '../../../domain/records';
import type { InspectPanelProps } from './contract';
import { RecordListContentEditor } from './record-list-content-editor';
import { StringListContentEditor } from './string-list-content-editor';

/** Exhaustive host adapter for registry-declared semantic content editors. */
export function ComponentContentEditor({ declaration, node, props }: {
  declaration: ContentEditorDeclaration;
  node: CanvasNode;
  props: InspectPanelProps;
}) {
  return declaration.kind === 'record-list'
    ? <RecordListContentEditor declaration={declaration} node={node} props={props} />
    : <StringListContentEditor declaration={declaration} node={node} props={props} />;
}
