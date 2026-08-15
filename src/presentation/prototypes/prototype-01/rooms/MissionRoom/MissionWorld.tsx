/**
 * The Mission World — one drawing, now mounted on the shared spatial surface.
 *
 * Mission World still decides what nodes mean, where they begin, and how reveal works.
 * WorldCanvas supplies the mechanics: pan, zoom, drag, selection, and viewport memory.
 */
import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react';
import { useMemo, type MouseEvent } from 'react';
import './mission-world.css';
import { useStore } from '../../app/store';
import { WorldCanvas } from '../../components/canvas/WorldCanvas';
import { EmptyState } from '../../components/ui/ui';
import { layoutMissionWorld } from '../../interaction/reveal-tree';
import type { ObjectRecord } from '../../object-graph/contract';
import { childStages, field, rootStages } from '../../object-graph/graph';
import { missionGraphToFlow, type MissionStageFlowNode } from './graph-to-flow';

/** Status as a shape as well as a word: filled, half, open, or crossed. */
function StatusMark({ status }: { status: string }) {
  return (
    <span className="stage-node__mark" data-status={status} aria-hidden="true">
      <span className="stage-node__mark-glyph" />
    </span>
  );
}

function stopThen(event: MouseEvent, action: () => void) {
  event.stopPropagation();
  action();
}

function StageNode({ data, selected }: NodeProps<MissionStageFlowNode>) {
  const { placed, attention, onSelect, onReveal, onOpen } = data;
  const status = field(placed.record, 'status');

  return (
    <div
      className="stage-node"
      data-selected={selected}
      data-attention={attention}
      data-status={status}
      data-depth={placed.depth}
    >
      <Handle id="sequence-in" type="target" position={Position.Top} />
      <Handle id="sequence-out" type="source" position={Position.Bottom} />
      <Handle id="branch-in" type="target" position={Position.Left} />
      <Handle id="branch-out" type="source" position={Position.Right} />

      <span className="stage-node__clamp" aria-hidden="true" />
      <button
        type="button"
        className="stage-node__body"
        onClick={(event) => stopThen(event, onSelect)}
        onDoubleClick={(event) => stopThen(event, onOpen)}
        aria-pressed={selected}
      >
        <span className="stage-node__head">
          <span className="eyebrow">Stage</span>
          <StatusMark status={status} />
        </span>
        <span className="stage-node__title">{placed.record.title}</span>
        <span className="stage-node__fact">{field(placed.record, 'condition')}</span>
      </button>
      <div className="stage-node__actions nodrag">
        {placed.hasChildren && (
          <button
            type="button"
            className="stage-node__action"
            data-revealed={placed.revealed}
            onClick={(event) => stopThen(event, onReveal)}
            title={placed.revealed ? 'Hide this structure' : 'Show this structure on the canvas'}
          >
            <span className="stage-node__action-chevron" aria-hidden="true">
              ›
            </span>
            {placed.revealed ? 'Hide' : 'Show on canvas'}
          </button>
        )}
        <button
          type="button"
          className="stage-node__action"
          onClick={(event) => stopThen(event, onOpen)}
          title="Enter this Stage"
        >
          Open Stage
          <span className="stage-node__action-arrow" aria-hidden="true">
            ↗
          </span>
        </button>
      </div>
    </div>
  );
}

const missionNodeTypes = { stage: StageNode } satisfies NodeTypes;

/** Mission and Stage rooms share this projection; only their subject and roots differ. */
export function MissionWorld({ subject, roots }: { subject: ObjectRecord; roots?: readonly ObjectRecord[] }) {
  const { graph, selected, select, enterRoom, revealed, toggleReveal, elected } = useStore();

  const sequence = useMemo(() => roots ?? rootStages(graph, subject.id), [graph, roots, subject.id]);
  const layout = useMemo(
    () => layoutMissionWorld(sequence, revealed, (id) => childStages(graph, id)),
    [graph, revealed, sequence],
  );
  const flow = useMemo(
    () =>
      missionGraphToFlow(layout, {
        selectedId: selected?.id ?? null,
        attentionId: elected?.subject.id ?? null,
        select,
        reveal: toggleReveal,
        open: (id) => enterRoom({ kind: 'stage', subjectId: id }),
      }),
    [elected?.subject.id, enterRoom, layout, select, selected?.id, toggleReveal],
  );

  if (sequence.length === 0) {
    return (
      <div className="mission-world mission-world--empty">
        <EmptyState>
          Nothing hangs here yet. Add the first stage to give this work a sequence to follow.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mission-world">
      <WorldCanvas
        viewportKey={`${subject.kind}:${subject.id}`}
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={missionNodeTypes}
        selectedId={selected?.id ?? null}
        onSelect={select}
        onOpen={(id) => enterRoom({ kind: 'stage', subjectId: id })}
      />
    </div>
  );
}
