import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { LanternFlowNode } from './vigil-projection';

/**
 * One conversation, burning at the distance of its silence.
 *
 * How much it says is decided by where it sits: a near lantern shows its last line,
 * a far one shows a name and nothing else. Mission appears only on the opened lantern
 * and only when the thread genuinely discusses one — a standalone conversation shows
 * no slot, no placeholder and no parent.
 */
export function VigilLanternNode({ data, selected }: NodeProps<LanternFlowNode>) {
  if (data.depth === 'mark') return <LanternMark data={data} selected={selected} />;

  const showsPreview = data.depth === 'near' || data.opened;

  return (
    <article
      className="vigil-lantern"
      style={{ width: data.width }}
      data-depth={data.depth}
      data-attention={data.attention}
      data-awaiting={data.awaitingReply}
      data-opened={data.opened}
      data-selected={selected}
    >
      <Handle type="target" position={Position.Top} className="vigil-lantern__handle" />
      <span className="vigil-lantern__flame" aria-hidden="true" />
      <span className="vigil-lantern__role">{data.agentRole}</span>
      <h3 className="vigil-lantern__name">{data.agentName}</h3>
      <span className="vigil-lantern__silence">{data.silence}</span>
      {showsPreview && <p className="vigil-lantern__preview">{data.preview}</p>}
      {data.missionTitle && (
        <span className="vigil-lantern__mission">{data.missionTitle}</span>
      )}
      {!data.opened && (
        <button
          type="button"
          className="vigil-lantern__open"
          onClick={(event) => {
            event.stopPropagation();
            data.onOpen(data.record.id);
          }}
        >
          Show exchange
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="vigil-lantern__handle" />
    </article>
  );
}

/**
 * A conversation too far out to be read.
 *
 * Out here a name could only ever be half-visible, so the mark shows that somebody is
 * still there and says nothing it cannot say properly. Selecting it opens Lantern
 * Core, which reads it out in full; the legend keeps the count.
 */
function LanternMark({
  data,
  selected,
}: {
  data: LanternFlowNode['data'];
  selected: boolean | undefined;
}) {
  return (
    <span
      className="vigil-mark"
      data-selected={selected}
      data-attention={data.attention}
      title={`${data.agentName} · ${data.silence}`}
    >
      <Handle type="target" position={Position.Top} className="vigil-lantern__handle" />
      <Handle type="source" position={Position.Bottom} className="vigil-lantern__handle" />
    </span>
  );
}
