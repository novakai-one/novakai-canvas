import { Handle, Position, type NodeProps } from '@xyflow/react';
import { KIND_LABEL } from '../../../../../object-graph/contract';
import type { BenchMessageInspectorCanvasNode } from '../model/bench-projection';
import './inspection.css';

/** Thin first trail node listing the exact message's typed relationships. */
export function MessageInspectorNode({ data, selected }: NodeProps<BenchMessageInspectorCanvasNode>) {
  return (
    <aside className="bench-inspector-node" data-selected={selected}>
      <Handle id="trail-target" className="bench-trail-handle" type="target" position={Position.Left} />
      <header className="bench-inspector-node__header">
        <span>
          <small>Relations from</small>
          <strong>{data.message.record.id}</strong>
        </span>
        <button
          type="button"
          className="bench-inspector-node__close nodrag"
          onClick={() => data.actions.closeTrailStep(data.trail.id, data.step.id)}
          aria-label="Close message inspection"
        >
          ×
        </button>
      </header>
      <p className="bench-inspector-node__excerpt">{data.message.body}</p>
      <div className="bench-inspector-node__relations">
        {data.message.relations.map((relation) => (
          <div className="bench-relation-row" key={`${relation.relation}:${relation.record.id}`}>
            <button
              type="button"
              className="nodrag"
              onClick={() => data.actions.expandRelation(
                data.trail.id,
                data.step.id,
                relation.relation,
                relation.record.id,
              )}
            >
              <span>{relation.label}</span>
              <strong>{relation.record.title}</strong>
              <small>{KIND_LABEL[relation.record.kind]}</small>
            </button>
            <Handle
              id={`relation:${relation.relation}:${relation.record.id}`}
              className="bench-relation-row__source"
              type="source"
              position={Position.Right}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
