import type { CSSProperties } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';
import { NodePorts } from '../../presentation/nodes/node-ports.tsx';
import { GLYPHS } from '../glyphs.ts';
import { layoutBlockText } from './component.ts';

type BlockFlowNode = Node<ArchitectureNodeData, 'block'>;

/** Selectable styled text whose geometry and line breaks come from the pure block component. */
export function BlockNode({ data }: NodeProps<BlockFlowNode>) {
  const { node, appearance, editable, preferences } = data;
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
    display: 'flex',
    flexDirection: 'column',
    justifyContent: appearance.verticalAlign === 'center' ? 'center'
      : appearance.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
    lineHeight: 1.4,
    padding: appearance.padding,
    textAlign: appearance.textAlign,
  } satisfies CSSProperties;
  const horizontalJustify = appearance.textAlign === 'left' ? 'flex-start'
    : appearance.textAlign === 'right' ? 'flex-end' : 'center';
  return (
    <div className={`block-node-shell${preferences.nodes.showPorts === 'always' ? ' ports-always' : ''}`}>
    <article className="block-node" style={style}>
      {appearance.icon ? (
        <>
          <span
            className="block-line"
            style={{ alignItems: 'center', display: 'flex', gap: layout.iconGap, justifyContent: horizontalJustify, minHeight: layout.firstRowHeight }}
          >
            <svg
              aria-label={`${appearance.icon} icon`}
              fill="none"
              height={layout.iconSize}
              role="img"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              style={{ flex: '0 0 auto' }}
              viewBox="0 0 24 24"
              width={layout.iconSize}
            >
              <path d={GLYPHS[appearance.icon]} />
            </svg>
            <span>{layout.lines[0]}</span>
          </span>
          {layout.lines.slice(1).map((line, index) => (
            <span className="block-line" key={`${index + 1}-${line}`}>{line}</span>
          ))}
        </>
      ) : layout.lines.map((line, index) => (
        <span className="block-line" key={`${index}-${line}`}>{line}</span>
      ))}
    </article>
    <NodePorts connectable={editable} />
    </div>
  );
}
