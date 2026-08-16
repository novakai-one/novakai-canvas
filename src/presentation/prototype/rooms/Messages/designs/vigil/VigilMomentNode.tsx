import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MomentFlowNode } from './vigil-projection';

/**
 * One message of the opened conversation, seated by its age.
 *
 * The newest few keep their words. Everything older collapses to a bead, so a long
 * history reads as a trail receding into the dark rather than a wall of text; clicking
 * a bead selects it and Lantern Core reads it out.
 */
export function VigilMomentNode({ data, selected }: NodeProps<MomentFlowNode>) {
  if (data.collapsed) {
    return (
      <span
        className="vigil-bead"
        data-mine={data.mine}
        data-selected={selected}
        title={`${data.speaker} · ${data.time}`}
      >
        <Handle type="target" position={Position.Top} className="vigil-bead__handle" />
        <Handle type="source" position={Position.Bottom} className="vigil-bead__handle" />
      </span>
    );
  }

  return (
    <article className="vigil-moment" data-mine={data.mine} data-selected={selected}>
      <Handle type="target" position={Position.Top} className="vigil-moment__handle" />
      <span className="vigil-moment__meta">
        {data.speaker} · {data.time}
      </span>
      <p className="vigil-moment__body">{data.body}</p>
      {data.referenceCount > 0 && (
        <span className="vigil-moment__references">
          {data.referenceCount} referenced {data.referenceCount === 1 ? 'object' : 'objects'}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="vigil-moment__handle" />
    </article>
  );
}
