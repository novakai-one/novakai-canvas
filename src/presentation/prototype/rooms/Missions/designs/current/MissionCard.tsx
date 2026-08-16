import type { ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import { StateChip } from '../../../../components/ui/ui';

type MissionCardProps = {
  readonly mission: ObjectRecord;
  readonly projectTitle: string;
  readonly completedStages: number;
  readonly totalStages: number;
  readonly selected: boolean;
  readonly needsAttention: boolean;
  onSelect(): void;
  onOpen(): void;
};

/** Store-independent card used only by the current Mission List design. */
export function MissionCard({
  mission,
  projectTitle,
  completedStages,
  totalStages,
  selected,
  needsAttention,
  onSelect,
  onOpen,
}: MissionCardProps) {
  return (
    <article
      className="missions-card"
      data-selected={selected}
      data-attention={needsAttention}
    >
      <button type="button" className="missions-card__body" onClick={onSelect}>
        <span className="missions-card__head">
          <span className="eyebrow">Mission</span>
          <StateChip state={field(mission, 'status')} />
        </span>
        <span className="missions-card__title">{mission.title}</span>
        <span className="missions-card__summary">{field(mission, 'notes')}</span>
      </button>
      <div className="missions-card__footer">
        <div className="missions-card__footer-left">
          <span>{projectTitle}</span>
          <span className="missions__reach">
            {completedStages}/{totalStages} stages
          </span>
        </div>
        <button
          type="button"
          className="missions-card__open"
          title="Open Mission"
          aria-label={`Open ${mission.title}`}
          onClick={onOpen}
        >
          Open
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </article>
  );
}
