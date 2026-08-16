import { Handle, Position, type NodeProps } from '@xyflow/react';
import { KIND_LABEL } from '../../../../object-graph/contract';
import type { AtlasNode, AtlasNodeData } from './atlas-projection';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function LandmarkBody({ data }: { data: AtlasNodeData }) {
  const { landmark, tier } = data;
  switch (landmark.variant) {
    case 'mission':
      return (
        <>
          <span className="atlas-landmark__kind">Mission basin</span>
          <strong className="atlas-landmark__mission-title">{landmark.record.title}</strong>
          <span className="atlas-landmark__mission-meta">
            {landmark.subtitle} <i /> {landmark.status}
          </span>
        </>
      );
    case 'agent':
      return (
        <>
          <span className="atlas-landmark__agent-core">{initials(landmark.record.title)}</span>
          <span className="atlas-landmark__agent-name">{landmark.record.title}</span>
          <span className="atlas-landmark__agent-status">{landmark.status}</span>
        </>
      );
    case 'thread':
      return (
        <>
          <span className="atlas-landmark__gate-mark" aria-hidden="true" />
          <span className="atlas-landmark__kind">Conversation ridge</span>
          <strong className="atlas-landmark__thread-title">{landmark.record.title}</strong>
          <span className="atlas-landmark__thread-meta">{landmark.subtitle}</span>
          {landmark.unread && <span className="atlas-landmark__unread">Unread signal</span>}
        </>
      );
    case 'message':
      return (
        <>
          <span className="atlas-landmark__station" aria-hidden="true">
            {landmark.sequence}
          </span>
          <span className="atlas-landmark__message-meta">{landmark.meta}</span>
          {tier !== 'overview' && (
            <span className="atlas-landmark__message-body">
              {tier === 'detail' ? landmark.body : landmark.body?.slice(0, 88)}
            </span>
          )}
        </>
      );
    case 'reference':
      return (
        <>
          <span className="atlas-landmark__cairn" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="atlas-landmark__kind">{KIND_LABEL[landmark.record.kind]}</span>
          {tier !== 'overview' && (
            <strong className="atlas-landmark__reference-title">{landmark.record.title}</strong>
          )}
        </>
      );
  }
}

export function AtlasLandmarkNode(props: NodeProps<AtlasNode>) {
  const { data, selected } = props;
  return (
    <div
      className="atlas-landmark"
      data-variant={data.landmark.variant}
      data-tier={data.tier}
      data-focused={data.focused}
      data-dimmed={data.dimmed}
      data-selected={selected}
      data-revealed={data.revealed}
      data-mine={data.landmark.mine ?? false}
    >
      <Handle className="atlas-landmark__handle" type="target" position={Position.Left} />
      <LandmarkBody data={data} />
      <Handle className="atlas-landmark__handle" type="source" position={Position.Right} />
    </div>
  );
}
