import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState } from 'react';
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import type { RiverNode } from './relay-river-projection';

function ReferenceDisclosure({
  record,
  sourceNodeId,
  data,
}: {
  record: ObjectRecord;
  sourceNodeId: string;
  data: RiverNode['data'];
}) {
  const [disclosed, setDisclosed] = useState(false);
  const preview = field(record, 'claim')
    || field(record, 'question')
    || field(record, 'blockedReason')
    || field(record, 'body');

  return (
    <div className="river-reference" data-disclosed={disclosed}>
      <button
        type="button"
        className="river-reference__label"
        aria-expanded={disclosed}
        onClick={(event) => {
          event.stopPropagation();
          setDisclosed((current) => !current);
        }}
      >
        <span>{KIND_LABEL[record.kind]}</span>
        <strong>{record.title}</strong>
      </button>
      {disclosed && (
        <div className="river-reference__context" onClick={(event) => event.stopPropagation()}>
          {preview && <p>{preview}</p>}
          <div className="river-reference__actions">
            <button type="button" onClick={() => data.onInspectReference(record, sourceNodeId)}>
              Inspect
            </button>
            {data.canOpen(record) && (
              <button type="button" onClick={() => data.open(record)}>
                Open {KIND_LABEL[record.kind]} ↗
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Headwater({ data }: { data: RiverNode['data'] }) {
  return (
    <>
      <span className="river-landmark__eyebrow">Mission headwater</span>
      <strong className="river-landmark__title">{data.missionTitle}</strong>
      <span className="river-landmark__context">
        {data.agentName} · {data.agentRole}
      </span>
    </>
  );
}

function MessageTurn({ id, data }: { id: string; data: RiverNode['data'] }) {
  const speaker = data.mine ? 'You' : data.agentName;
  return (
    <>
      <span className="river-landmark__message-meta">{speaker} · {data.meta}</span>
      <p className="river-landmark__message-body">{data.body}</p>
      {data.references.length > 0 && (
        <div className="river-landmark__references">
          {data.references.map((reference) => (
            <ReferenceDisclosure key={reference.id} record={reference} sourceNodeId={id} data={data} />
          ))}
        </div>
      )}
    </>
  );
}

function NowBasin({ id, data }: { id: string; data: RiverNode['data'] }) {
  return (
    <>
      <span className="river-landmark__now-label">
        <i aria-hidden="true" /> Now · {data.unresolved ? 'needs your reply' : 'latest turn'}
      </span>
      <strong className="river-landmark__now-title">{data.record.title}</strong>
      {data.body !== data.record.title && <p className="river-landmark__message-body">{data.body}</p>}
      {data.references.map((reference) => (
        <ReferenceDisclosure key={reference.id} record={reference} sourceNodeId={id} data={data} />
      ))}
    </>
  );
}

function Tributary({ data }: { data: RiverNode['data'] }) {
  return (
    <>
      <span className="river-landmark__eyebrow">Conversation tributary</span>
      <strong className="river-landmark__title">{data.agentName}</strong>
      <span className="river-landmark__context">{data.missionTitle}</span>
      <p className="river-landmark__tributary-preview">{data.body}</p>
    </>
  );
}

function LandmarkContent({ id, data }: { id: string; data: RiverNode['data'] }) {
  switch (data.variant) {
    case 'headwater':
      return <Headwater data={data} />;
    case 'message':
      return <MessageTurn id={id} data={data} />;
    case 'now':
      return <NowBasin id={id} data={data} />;
    case 'tributary':
      return <Tributary data={data} />;
    case 'empty':
      return (
        <>
          <span className="river-landmark__eyebrow">New conversation</span>
          <strong className="river-landmark__title">The current starts here.</strong>
          <p className="river-landmark__empty-copy">Say something to {data.agentName} below.</p>
        </>
      );
  }
}

/** Renders one semantic landmark without owning graph or navigation state. */
export function RiverLandmarkNode({ id, data, selected }: NodeProps<RiverNode>) {
  return (
    <article
      className="river-landmark"
      data-variant={data.variant}
      data-mine={data.mine}
      data-selected={selected}
      data-unresolved={data.unresolved}
    >
      <Handle type="target" position={Position.Top} className="river-landmark__handle" />
      <LandmarkContent id={id} data={data} />
      <Handle type="source" position={Position.Bottom} className="river-landmark__handle" />
    </article>
  );
}
