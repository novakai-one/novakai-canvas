/** The original Stage sheet, preserved as the default registered design. */
import './current-stage-sheet.css';
import { field } from '../../../../object-graph/graph';
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { StateChip, EmptyState } from '../../../../components/ui/ui';
import type { StageDesignProps } from '../../stage-design';

function SheetRow({ record, note, eyebrow, selected, onSelect }: {
  record: ObjectRecord;
  note?: string;
  eyebrow?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="stage-room__row"
      data-selected={selected}
      onClick={onSelect}
    >
      <span className="stage-room__row-text">
        <span className="eyebrow">{eyebrow ?? KIND_LABEL[record.kind]}</span>
        <span className="stage-room__row-title">{record.title}</span>
        {note && <span className="stage-room__row-note">{note}</span>}
      </span>
      <StateChip state={field(record, 'status')} />
    </button>
  );
}

/** Existing Stage sheet UI translated to the stable room design contract. */
export function CurrentStageSheet({ data, commands }: StageDesignProps) {
  const { conditionLine, tasks, childStages, blockers, selected } = data;

  return (
    <div className="stage-room">
      <article className="stage-room__sheet">
        <p className="stage-room__condition">
          <span className="eyebrow">Done when</span>
          {conditionLine}
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
              <SheetRow
                key={task.id}
                record={task}
                note={field(task, 'blockedReason') || undefined}
                selected={selected?.id === task.id}
                onSelect={() => commands.select(task)}
              />
            ))}
          </div>
        )}

        {childStages.length > 0 && (
          <>
            <h2 className="stage-room__heading">
              Inside this stage
              <span className="stage-room__count">{childStages.length}</span>
            </h2>
            <div className="stage-room__rows">
              {childStages.map((child) => (
                <div className="stage-room__nested" key={child.id}>
                  <SheetRow
                    record={child}
                    eyebrow="Stage"
                    note={field(child, 'condition')}
                    selected={selected?.id === child.id}
                    onSelect={() => commands.select(child)}
                  />
                  <button
                    type="button"
                    className="stage-room__open"
                    title="Enter this Stage"
                    aria-label={`Open ${child.title}`}
                    onClick={() => commands.enterChildStage(child)}
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
                <SheetRow
                  key={blocker.id}
                  record={blocker}
                  selected={selected?.id === blocker.id}
                  onSelect={() => commands.select(blocker)}
                />
              ))}
            </div>
          </>
        )}
      </article>
    </div>
  );
}
