/**
 * A Stage as the focused Room.
 *
 * Entering a Stage narrows the working context to that Stage and its own children; the
 * surrounding Mission is still one Back away, and the same two projections apply. A leaf
 * Stage has no sequence to draw, so its World shows the work attached to it instead.
 */
import './stage-room.css';
import { useStore } from '../../app/store';
import { childStages, field } from '../../object-graph/graph';
import { MissionWorld } from '../MissionRoom/MissionWorld';
import { StateChip, EmptyState } from '../../components/ui/ui';
import { KIND_LABEL } from '../../object-graph/contract';

export function StageRoom({ stageId }: { stageId: string }) {
  const { graph, projection, select, selected, enterRoom } = useStore();
  const stage = graph.get(stageId);
  if (!stage) return null;

  const children = childStages(graph, stageId);
  const tasks = graph.relatedOfKind(stageId, 'contains', 'task');
  const blockers = graph.relatedBy(stageId, 'blockedBy');

  if (projection === 'world' && children.length > 0) {
    return <MissionWorld subject={stage} roots={children} />;
  }

  return (
    <div className="stage-room">
      <article className="stage-room__sheet">
        <p className="stage-room__condition">
          <span className="eyebrow">Done when</span>
          {field(stage, 'condition')}
        </p>

        <h2 className="stage-room__heading">
          Work in this stage
          <span className="stage-room__count">{tasks.length}</span>
        </h2>
        {tasks.length === 0 ? (
          <EmptyState>No tasks are attached to this stage yet.</EmptyState>
        ) : (
          <div className="stage-room__rows">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className="stage-room__row"
                data-selected={selected?.id === task.id}
                onClick={() => select(task.id)}
              >
                <span className="stage-room__row-text">
                  <span className="eyebrow">{KIND_LABEL[task.kind]}</span>
                  <span className="stage-room__row-title">{task.title}</span>
                  {field(task, 'blockedReason') && (
                    <span className="stage-room__row-note">{field(task, 'blockedReason')}</span>
                  )}
                </span>
                <StateChip state={field(task, 'status')} />
              </button>
            ))}
          </div>
        )}

        {children.length > 0 && (
          <>
            <h2 className="stage-room__heading">
              Inside this stage
              <span className="stage-room__count">{children.length}</span>
            </h2>
            <div className="stage-room__rows">
              {children.map((child) => (
                <div className="stage-room__nested" key={child.id}>
                  <button
                    type="button"
                    className="stage-room__row"
                    data-selected={selected?.id === child.id}
                    onClick={() => select(child.id)}
                  >
                    <span className="stage-room__row-text">
                      <span className="eyebrow">Stage</span>
                      <span className="stage-room__row-title">{child.title}</span>
                      <span className="stage-room__row-note">{field(child, 'condition')}</span>
                    </span>
                    <StateChip state={field(child, 'status')} />
                  </button>
                  <button
                    type="button"
                    className="stage-room__open"
                    title="Enter this Stage"
                    aria-label={`Open ${child.title}`}
                    onClick={() => enterRoom({ kind: 'stage', subjectId: child.id })}
                  >
                    ↗
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {blockers.length > 0 && (
          <>
            <h2 className="stage-room__heading">
              Holding this up
              <span className="stage-room__count">{blockers.length}</span>
            </h2>
            <div className="stage-room__rows">
              {blockers.map((blocker) => (
                <button
                  key={blocker.id}
                  type="button"
                  className="stage-room__row"
                  data-selected={selected?.id === blocker.id}
                  onClick={() => select(blocker.id)}
                >
                  <span className="stage-room__row-text">
                    <span className="eyebrow">{KIND_LABEL[blocker.kind]}</span>
                    <span className="stage-room__row-title">{blocker.title}</span>
                  </span>
                  <StateChip state={field(blocker, 'status')} />
                </button>
              ))}
            </div>
          </>
        )}
      </article>
    </div>
  );
}
