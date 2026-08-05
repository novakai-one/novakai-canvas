import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react';
import { ARCHITECTURE_FLOW } from '../../domain/flow';
import type { ArchitectureNodeData } from '../projection';

type ScopeFlowNode = Node<ArchitectureNodeData, 'scope'>;

/**
 * Quiet project-scope container renderer.
 *
 * A group is a frame, not a surface. Its interior belongs to whatever is drawn inside it and to
 * the empty canvas between them, so the whole body is click-through (`pointer-events`, set in
 * `canvas.css` on the React Flow wrapper as well as here) and only the title bar answers the
 * pointer. That is what lets a click in a group's empty middle reach the pane and deselect —
 * the single interaction Chris named as the worst of the canvas.
 */
export function ScopeNode({ data, selected }: NodeProps<ScopeFlowNode>) {
  const portPosition = { top: Position.Top, bottom: Position.Bottom } as const;
  const standalone = data.node.label.startsWith('Standalone');
  return (
    <section className={`scope-node${standalone ? ' scope-node--standalone' : ''}${selected ? ' is-selected' : ''}`}>
      <NodeResizer isVisible={data.editable && selected} minHeight={160} minWidth={320} />
      <Handle isConnectable={data.editable} type="target" position={portPosition[ARCHITECTURE_FLOW.targetPort]} />
      <span
        className="scope-node__title"
        onClick={(event) => { event.stopPropagation(); data.select({ kind: 'node', id: data.node.id }); }}
      >{data.node.label}</span>
      <Handle isConnectable={data.editable} type="source" position={portPosition[ARCHITECTURE_FLOW.sourcePort]} />
    </section>
  );
}
