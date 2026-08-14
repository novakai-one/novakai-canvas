/**
 * Projects, and the missions attached to them.
 *
 * The relationship runs both ways off one stored ref: a project lists its missions here,
 * and each mission's inspector opens back to its project. Neither side keeps a copy.
 */
import { useState } from 'react';
import './projects.css';
import { makeRecord, sessionId, useStore } from '../../app/store';
import { field } from '../../object-graph/graph';
import { ActionButton, EmptyState, StateChip } from '../../components/ui/ui';
import type { ObjectRecord } from '../../object-graph/contract';

function MissionLine({ mission }: { mission: ObjectRecord }) {
  const { select, selected, enterRoom, elected } = useStore();
  return (
    <div
      className="project-column__mission"
      data-selected={selected?.id === mission.id}
      data-attention={elected?.subject.id === mission.id}
    >
      <button type="button" className="project-column__mission-body" onClick={() => select(mission.id)}>
        <span className="project-column__mission-title">{mission.title}</span>
        <StateChip state={field(mission, 'status')} />
      </button>
      <button
        type="button"
        className="project-column__mission-open"
        title="Open this Mission"
        aria-label={`Open ${mission.title}`}
        onClick={() => enterRoom({ kind: 'mission', subjectId: mission.id })}
      >
        ↗
      </button>
    </div>
  );
}

function ProjectColumn({ project }: { project: ObjectRecord }) {
  const { graph, select, selected, enterRoom, addRecord } = useStore();
  const missions = graph.relatedOfKind(project.id, 'contains', 'mission');
  const [drafting, setDrafting] = useState(false);
  const [title, setTitle] = useState('');

  const createDraft = () => {
    const name = title.trim() || 'New mission';
    const id = sessionId('mission', name);
    addRecord(
      makeRecord(
        id,
        'mission',
        name,
        {
          status: 'draft',
          priority: 'medium',
          owner: 'principal_chris',
          notes: `Drafted from ${project.title}. Give it stages when you know the shape.`,
          updated: new Date().toISOString(),
        },
        [{ kind: 'project', value: project.id }],
      ),
    );
    setTitle('');
    setDrafting(false);
    select(id);
  };

  return (
    <section className="project-column" data-selected={selected?.id === project.id}>
      <header className="project-column__head">
        <button type="button" className="project-column__identity" onClick={() => select(project.id)}>
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
            onClick={() => enterRoom({ kind: 'project', subjectId: project.id })}
          >
            ↗
          </button>
        </div>
      </header>

      <div className="project-column__missions">
        {missions.length === 0 && <EmptyState>Nothing attached yet.</EmptyState>}
        {missions.map((mission) => (
          <MissionLine key={mission.id} mission={mission} />
        ))}
      </div>

      {drafting ? (
        <form
          className="project-column__draft"
          onSubmit={(event) => {
            event.preventDefault();
            createDraft();
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
          <ActionButton variant="primary" onClick={createDraft}>
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

export function Projects() {
  const { graph, addRecord, select } = useStore();
  const projects = graph.byKind('project');
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const createProject = () => {
    const title = name.trim() || 'New project';
    const id = sessionId('proj', title);
    addRecord(
      makeRecord(id, 'project', title, {
        status: 'active',
        focus: 'Not written yet.',
        path: `~/Programming/${title.toLowerCase().replace(/\s+/g, '-')}`,
        updated: new Date().toISOString(),
      }),
    );
    setName('');
    setNaming(false);
    select(id);
  };

  return (
    <div className="projects">
      <div className="projects__board">
        {projects.map((project) => (
          <ProjectColumn key={project.id} project={project} />
        ))}

        <section className="projects__new">
          {naming ? (
            <form
              className="projects__new-form"
              onSubmit={(event) => {
                event.preventDefault();
                createProject();
              }}
            >
              <input
                className="project-column__draft-input"
                value={name}
                autoFocus
                placeholder="Project name"
                onChange={(event) => setName(event.target.value)}
              />
              <ActionButton variant="primary" onClick={createProject}>
                Create project
              </ActionButton>
            </form>
          ) : (
            <button type="button" className="projects__new-button" onClick={() => setNaming(true)}>
              + New project
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
