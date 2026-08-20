import type { CSSProperties } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';
import { layoutBlockText } from './component.ts';

type BlockFlowNode = Node<ArchitectureNodeData, 'block'>;

/** Selectable styled text whose geometry and line breaks come from the pure block component. */
export function BlockNode({ data }: NodeProps<BlockFlowNode>) {
  const { node, appearance } = data;
  const layout = layoutBlockText(node.label, node.lines ?? [], appearance);
  const style = {
    background: appearance.backgroundColor,
    borderColor: appearance.borderColor,
    borderRadius: appearance.borderRadius,
    borderWidth: appearance.borderWidth,
    color: appearance.textColor,
    fontFamily: appearance.fontFamily,
    fontSize: appearance.fontSize,
    fontWeight: appearance.fontWeight,
    lineHeight: 1.4,
    padding: appearance.padding,
    textAlign: appearance.textAlign,
  } satisfies CSSProperties;
  return (
    <article className="block-node" style={style}>
      {layout.lines.map((line, index) => (
        <span className="block-line" key={`${index}-${line}`}>{line}</span>
      ))}
    </article>
  );
}
