import { Handle, Position, type NodeProps } from '@xyflow/react';
import { RELATION_LABEL } from '../../../../../object-graph/contract';
import type { BenchRelatedObjectCanvasNode } from '../model/bench-projection';
import { ObjectNodeBody } from './ObjectNodeBody';

/** One related object placed to the right of its parent trail step. */
export function RelatedObjectNode({ data, selected }: NodeProps<BenchRelatedObjectCanvasNode>) {
  return (
    <aside className="bench-related-node" data-selected={selected}>
      <Handle id="trail-target" className="bench-trail-handle" type="target" position={Position.Left} />
      <header className="bench-related-node__header">
        <span>{data.step.relation ? RELATION_LABEL[data.step.relation] ?? data.step.relation : 'Related'}</span>
        <button
          type="button"
          className="nodrag"
          onClick={() => data.actions.closeTrailStep(data.trail.id, data.step.id)}
          aria-label={`Close ${data.record.title}`}
        >
          ×
        </button>
      </header>
      <ObjectNodeBody
        record={data.record}
        relations={data.relations}
        decisionRequest={data.decisionRequest}
        onExpand={(relation) => data.actions.expandRelation(
          data.trail.id,
          data.step.id,
          relation.relation,
          relation.record.id,
        )}
        actions={data.actions}
      />
    </aside>
  );
}
