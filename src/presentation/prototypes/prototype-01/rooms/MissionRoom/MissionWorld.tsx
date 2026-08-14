/**
 * The Mission World — one drawing, not a field of cards.
 *
 * Immediate Stages hang from a single plumb line, first at the top and last at the
 * bottom. Selecting one opens its inspector and leaves you here. `Show on canvas` draws
 * a branch out to the right and clamps that Stage's own structure onto it, recursively.
 * Only `Open Stage` changes the Room.
 */
import './mission-world.css';
import { useStore } from '../../app/store';
import { childStages, field, rootStages } from '../../object-graph/graph';
import type { ObjectRecord } from '../../object-graph/contract';
import {
  branchPath,
  layoutMissionWorld,
  NODE_HEIGHT,
  NODE_WIDTH,
  SPINE_X,
  TOP,
  type PlacedNode,
} from '../../interaction/reveal-tree';
import { EmptyState } from '../../components/ui/ui';

/** Status as a shape as well as a word: filled, half, open, or crossed. */
function StatusMark({ status }: { status: string }) {
  return (
    <span className="stage-node__mark" data-status={status} aria-hidden="true">
      <span className="stage-node__mark-glyph" />
    </span>
  );
}

function StageNode({
  node,
  selected,
  elected,
  delay,
  onSelect,
  onReveal,
  onOpen,
}: {
  node: PlacedNode;
  selected: boolean;
  elected: boolean;
  delay: number;
  onSelect: () => void;
  onReveal: () => void;
  onOpen: () => void;
}) {
  const status = field(node.record, 'status');
  return (
    <div
      className="stage-node"
      style={{ left: node.x, top: node.y, width: NODE_WIDTH, animationDelay: `${delay}ms` }}
      data-selected={selected}
      data-attention={elected}
      data-status={status}
      data-depth={node.depth}
    >
      <span className="stage-node__clamp" aria-hidden="true" />
      <button
        type="button"
        className="stage-node__body"
        onClick={onSelect}
        onDoubleClick={onOpen}
        aria-pressed={selected}
      >
        <span className="stage-node__head">
          <span className="eyebrow">Stage</span>
          <StatusMark status={status} />
        </span>
        <span className="stage-node__title">{node.record.title}</span>
        <span className="stage-node__fact">{field(node.record, 'condition')}</span>
      </button>
      <div className="stage-node__actions">
        {node.hasChildren && (
          <button
            type="button"
            className="stage-node__action"
            data-revealed={node.revealed}
            onClick={onReveal}
            title={node.revealed ? 'Hide this structure' : 'Show this structure on the canvas'}
          >
            <span className="stage-node__action-chevron" aria-hidden="true">
              ›
            </span>
            {node.revealed ? 'Hide' : 'Show on canvas'}
          </button>
        )}
        <button type="button" className="stage-node__action" onClick={onOpen} title="Enter this Stage">
          Open Stage
          <span className="stage-node__action-arrow" aria-hidden="true">
            ↗
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * Draws the sequence hanging from one subject's spine.
 *
 * A Mission hangs its immediate Stages; a Stage Room hangs its own children from the
 * same drawing, which is why the two Rooms share one component rather than two that
 * drift apart.
 */
export function MissionWorld({ subject, roots }: { subject: ObjectRecord; roots?: readonly ObjectRecord[] }) {
  const { graph, selected, select, enterRoom, revealed, toggleReveal, elected } = useStore();

  const mission = subject;
  const sequence = roots ?? rootStages(graph, subject.id);
  const layout = layoutMissionWorld(sequence, revealed, (id) => childStages(graph, id));
  const byId = new Map(layout.nodes.map((node) => [node.record.id, node]));

  if (sequence.length === 0) {
    return (
      <div className="mission-world mission-world--empty">
        <EmptyState>
          Nothing hangs here yet. Add the first stage to give this work a sequence to follow.
        </EmptyState>
      </div>
    );
  }

  const rootNodes = layout.nodes.filter((node) => node.depth === 0);
  const missionDone = field(mission, 'status') === 'completed';
  /** The bright reach: how far down the spine work has actually got. */
  const activeIndex = rootNodes.findIndex((node) => field(node.record, 'status') !== 'done');
  const reachTo =
    activeIndex === -1
      ? layout.spineEnd
      : (rootNodes[activeIndex]?.y ?? TOP) + NODE_HEIGHT / 2;

  return (
    <div
      className="mission-world"
      onClick={() => select(null)}
      role="presentation"
    >
      <div
        className="mission-world__canvas"
        style={{ width: layout.width, height: layout.height }}
        onClick={(event) => event.stopPropagation()}
        role="presentation"
      >
        {/* The plumb line and every branch drawn off it: one SVG, one drawing. */}
        <svg
          className="mission-world__lines"
          width={layout.width}
          height={layout.height}
          aria-hidden="true"
        >
          <line
            className="mission-world__spine"
            x1={SPINE_X}
            y1={TOP - 28}
            x2={SPINE_X}
            y2={layout.spineEnd + 46}
          />
          <line
            className="mission-world__reach"
            x1={SPINE_X}
            y1={TOP - 28}
            x2={SPINE_X}
            y2={reachTo}
          />
          {rootNodes.map((node) => (
            <line
              key={`clamp-${node.record.id}`}
              className="mission-world__clamp-line"
              x1={SPINE_X}
              y1={node.y + NODE_HEIGHT / 2}
              x2={node.x}
              y2={node.y + NODE_HEIGHT / 2}
            />
          ))}
          {/* Sequence arrows: the wire from each stage to the next, on the spine. */}
          {rootNodes.slice(0, -1).map((node, index) => {
            const midpoint = (node.y + NODE_HEIGHT / 2 + rootNodes[index + 1].y + NODE_HEIGHT / 2) / 2;
            return (
              <path
                key={`arrow-${node.record.id}`}
                className="mission-world__sequence-arrow"
                d={`M ${SPINE_X - 4} ${midpoint - 4} L ${SPINE_X} ${midpoint + 2} L ${SPINE_X + 4} ${midpoint - 4}`}
              />
            );
          })}
          {layout.nodes
            .filter((node) => node.parentId)
            .map((node) => {
              const parent = byId.get(node.parentId!);
              if (!parent) return null;
              return (
                <path
                  key={`branch-${node.record.id}`}
                  className="mission-world__branch"
                  d={branchPath(parent, node)}
                />
              );
            })}
          <g className="mission-world__bob" data-landed={missionDone}>
            <rect
              x={SPINE_X - 5}
              y={layout.spineEnd + 42}
              width={10}
              height={10}
              transform={`rotate(45 ${SPINE_X} ${layout.spineEnd + 47})`}
            />
          </g>
        </svg>

        {layout.nodes.map((node, index) => (
          <StageNode
            key={node.record.id}
            node={node}
            delay={Math.min(index, 8) * 45}
            selected={selected?.id === node.record.id}
            elected={elected?.subject.id === node.record.id}
            onSelect={() => select(node.record.id)}
            onReveal={() => toggleReveal(node.record.id)}
            onOpen={() => enterRoom({ kind: 'stage', subjectId: node.record.id })}
          />
        ))}
      </div>
    </div>
  );
}
