/** The original Mission List, preserved as the default registered design. */
import { useState } from 'react';
import './current-missions.css';
import { field } from '../../../../object-graph/graph';
import { ActionButton, EmptyState, FilterGroup, SearchField } from '../../../../components/ui/ui';
import type { MissionsDesignProps } from '../../missions-design';
import { MissionCard } from './MissionCard';

const FILTERS = ['all', 'draft', 'planned', 'active', 'paused', 'completed'] as const;

/** Existing Mission List UI translated to the stable room design contract. */
export function CurrentMissions({ data, commands }: MissionsDesignProps) {
  const { graph, projects, templates, selected, attentionSubjectId } = data;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState(
    projects.some((project) => project.id === 'proj_command')
      ? 'proj_command'
      : (projects[0]?.id ?? ''),
  );
  const [templateId, setTemplateId] = useState('');

  const missions = data.missions
    .filter((mission) => (filter === 'all' ? true : field(mission, 'status') === filter))
    .filter((mission) => mission.title.toLowerCase().includes(query.toLowerCase()));

  const submitMission = () => {
    commands.create({ title, notes, projectId, templateId: templateId || undefined });
    setCreating(false);
    setTitle('');
    setNotes('');
    setTemplateId('');
  };

  return (
    <div className="missions">
      <div className="missions__sheet">
        <div className="missions__toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Search missions" />
          <FilterGroup options={FILTERS} value={filter} onChange={setFilter} />
          <ActionButton onClick={() => setCreating((value) => !value)}>
            {creating ? 'Cancel' : 'New mission'}
          </ActionButton>
        </div>

        {creating && (
          <form
            className="missions__create"
            onSubmit={(event) => {
              event.preventDefault();
              submitMission();
            }}
          >
            <label className="missions__label">
              What is the outcome?
              <input
                className="missions__input"
                value={title}
                autoFocus
                placeholder="Name the thing that will be true when this is done"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="missions__label">
              Notes
              <textarea
                className="missions__input missions__input--area"
                value={notes}
                rows={2}
                placeholder="One or two lines on what this mission owns"
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <div className="missions__create-row">
              <label className="missions__label">
                Project
                <select
                  className="missions__input"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="missions__label">
                Template
                <select
                  className="missions__input"
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                >
                  <option value="">No template — start empty</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title} ({Array.isArray(template.fields.stageTitles)
                        ? template.fields.stageTitles.length
                        : 0} stages)
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="missions__create-actions">
              <ActionButton variant="primary" onClick={submitMission}>
                Create mission
              </ActionButton>
            </div>
          </form>
        )}

        {missions.length === 0 ? (
          <EmptyState>
            No mission matches that. Clear the filter, or create the mission you were looking for.
          </EmptyState>
        ) : (
          <div className="missions__grid">
            {missions.map((mission) => {
              const project = graph.relatedBy(mission.id, 'belongsTo')
                .find((record) => record.kind === 'project');
              const stages = graph
                .relatedOfKind(mission.id, 'contains', 'stage')
                .filter((stage) => !stage.fields.parentStageId);
              const completedStages = stages.filter((stage) => field(stage, 'status') === 'done').length;

              return (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  projectTitle={project?.title ?? 'No project'}
                  completedStages={completedStages}
                  totalStages={stages.length}
                  selected={selected?.id === mission.id}
                  needsAttention={attentionSubjectId === mission.id}
                  onSelect={() => commands.select(mission)}
                  onOpen={() => commands.open(mission)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
