import type { CSSProperties } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import type { ArchitectureNodeData } from '../../presentation/projection.ts';
import { NodePorts } from '../node-ports.tsx';
import { GLYPHS, inscribedContentBox, layoutBlockText, outlinePath } from '@novakai/canvas';
import type { ResolvedNodeAppearance } from '@novakai/canvas';

type BlockFlowNode = Node<ArchitectureNodeData, 'block'>;
type BlockLayout = ReturnType<typeof layoutBlockText>;
type BoxSize = { width: number; height: number };

/** The shape's border drawn behind the text from the same outline table SVG snapshots use. */
function ShapeUnderlay({ appearance, size }: {
  appearance: ResolvedNodeAppearance;
  size: BoxSize;
}) {
  return (
    <svg
      aria-hidden
      height="100%"
      preserveAspectRatio="none"
      style={{ inset: 0, position: 'absolute' }}
      viewBox={`0 0 ${size.width} ${size.height}`}
      width="100%"
    >
      <path
        d={outlinePath(appearance.shape, size)}
        fill={appearance.backgroundColor}
        stroke={appearance.borderColor}
        strokeWidth={appearance.borderWidth}
      />
    </svg>
  );
}

/** A rectangle carries its own CSS border; any other shape sits inside its inscribed box. */
function bodyStyle(appearance: ResolvedNodeAppearance, size: BoxSize): CSSProperties {
  const text: CSSProperties = {
    color: appearance.textColor,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: appearance.fontFamily,
    fontSize: appearance.fontSize,
    fontWeight: appearance.fontWeight,
    justifyContent: appearance.verticalAlign === 'center' ? 'center'
      : appearance.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
    lineHeight: 1.4,
    padding: appearance.padding,
    textAlign: appearance.textAlign,
  };
  if (appearance.shape === 'rect') {
    return {
      ...text,
      background: appearance.backgroundColor,
      borderColor: appearance.borderColor,
      borderRadius: appearance.borderRadius,
      borderWidth: appearance.borderWidth,
    };
  }
  const inner = inscribedContentBox(appearance.shape, size);
  return {
    ...text,
    borderWidth: 0,
    height: inner.height,
    left: inner.x,
    position: 'absolute',
    top: inner.y,
    width: inner.width,
  };
}

/** The wrapped lines, with the shared glyph beside the first line when an icon is chosen. */
function BlockLines({ appearance, layout }: {
  appearance: ResolvedNodeAppearance;
  layout: BlockLayout;
}) {
  if (!appearance.icon) {
    return layout.lines.map((line, index) => (
      <span className="block-line" key={`${index}-${line}`}>{line}</span>
    ));
  }
  const horizontalJustify = appearance.textAlign === 'left' ? 'flex-start'
    : appearance.textAlign === 'right' ? 'flex-end' : 'center';
  return (
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
  );
}

/** Selectable styled text whose geometry and line breaks come from the pure block component. */
export function BlockNode({ data }: NodeProps<BlockFlowNode>) {
  const { node, appearance, editable, preferences } = data;
  const layout = layoutBlockText(node.label, node.lines ?? [], appearance);
  return (
    <div className={`block-node-shell${preferences.nodes.showPorts === 'always' ? ' ports-always' : ''}`}>
      {appearance.shape !== 'rect' && <ShapeUnderlay appearance={appearance} size={node.size} />}
      <article className="block-node" style={bodyStyle(appearance, node.size)}>
        <BlockLines appearance={appearance} layout={layout} />
      </article>
      <NodePorts connectable={editable} methods={data.interfaces} node={node} />
    </div>
  );
}
