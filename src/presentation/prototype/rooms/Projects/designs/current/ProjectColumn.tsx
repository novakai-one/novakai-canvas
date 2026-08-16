/** One project's column: identity, its missions, and an inline mission-draft form. */
import { useState } from 'react';
import { field } from '../../../../object-graph/graph';
import { ActionButton, EmptyState, StateChip } from '../../../../components/ui/ui';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { ProjectsDesignCommands, ProjectsDesignData } from '../../projects-design';

type ProjectColumnProps = {
  project: ObjectRecord;
  data: ProjectsDesignData;
  commands: ProjectsDesignCommands;
};

function MissionLine({ mission, data, commands }: {
  mission: ObjectRecord;
  data: ProjectsDesignData;
  commands: ProjectsDesignCommands;
}) {
  return (
    <div
      className="project-column__mission"
      data-selected={data.selected?.id === mission.id}
      data-attention={data.attentionSubjectId === mission.id}
    >
      <button
        type="button"
        className="project-column__mission-body"
        onClick={() => commands.select(mission)}
      >
        <span className="project-column__mission-title">{mission.title}</span>
        <StateChip state={field(mission, 'status')} />
      </button>
      <button
        type="button"
        className="project-column__mission-open"
        title="Open this Mission"
        aria-label={`Open ${mission.title}`}
        onClick={() => commands.open(mission)}
      >
        ↗
      </button>
    </div>
  );
}

/** A project and everything attached to it, drawn from the host's graph on each render. */
export function ProjectColumn({ project, data, commands }: ProjectColumnProps) {
  const missions = data.graph.relatedOfKind(project.id, 'contains', 'mission');
  const [drafting, setDrafting] = useState(false);
  const [title, setTitle] = useState('');

  const submitDraft = () => {
    commands.draftMission({ title, projectId: project.id });
    setTitle('');
    setDrafting(false);
  };

  return (
    <section className="project-column" data-selected={data.selected?.id === project.id}>
      <header className="project-column__head">
        <button
          type="button"
          className="project-column__identity"
          onClick={() => commands.select(project)}
        >
          <span className="eyebrow">Project</span>
          <span className="project-column__title">{project.title}</span>
          <span className="project-column__focus">{field(project, 'focus')}</span>
        </button>
        <div className="project-column__head-right">
          <span className="project-column__count">{missions.length}</span>
          <button
            type="button"
            className="project-column__open"
            title="Open this Project"
            aria-label={`Open ${project.title}`}
            onClick={() => commands.open(project)}
          >
            ↗
          </button>
        </div>
      </header>

      <div className="project-column__missions">
        {missions.length === 0 && <EmptyState>Nothing attached yet.</EmptyState>}
        {missions.map((mission) => (
          <MissionLine key={mission.id} mission={mission} data={data} commands={commands} />
        ))}
      </div>

      {drafting ? (
        <form
          className="project-column__draft"
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <input
            className="project-column__draft-input"
            value={title}
            autoFocus
            placeholder="Name the outcome"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => title.trim() === '' && setDrafting(false)}
          />
          <ActionButton variant="primary" onClick={submitDraft}>
            Add draft
          </ActionButton>
        </form>
      ) : (
        <button type="button" className="project-column__add" onClick={() => setDrafting(true)}>
          + Draft a mission here
        </button>
      )}
    </section>
  );
}
