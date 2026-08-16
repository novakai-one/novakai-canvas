/**
 * The durable mission library, and where a new mission starts.
 *
 * Creating one from a template gives it its stages immediately, so a new mission opens
 * onto a real spine rather than an empty canvas.
 */
import { useState } from 'react';
import './missions.css';
import { makeRecord, sessionId, useStore } from '../../app/store';
import { field } from '../../object-graph/graph';
import { ActionButton, EmptyState, FilterGroup, SearchField, StateChip } from '../../components/ui/ui';
import { ObjectCard } from '../../components/ObjectCard/ObjectCard';

const FILTERS = ['all', 'draft', 'planned', 'active', 'paused', 'completed'] as const;

export function Missions() {
  const { graph, addRecord, enterRoom, select } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState('proj_command');
  const [templateId, setTemplateId] = useState('');

  const projects = graph.byKind('project');
  const templates = graph.byKind('missionTemplate');

  const missions = graph
    .byKind('mission')
    .filter((mission) => (filter === 'all' ? true : field(mission, 'status') === filter))
    .filter((mission) => mission.title.toLowerCase().includes(query.toLowerCase()));

  const create = () => {
    const name = title.trim() || 'Untitled mission';
    const id = sessionId('mission', name);
    const template = templates.find((t) => t.id === templateId);
    const refs = [
      { kind: 'project', value: projectId },
      ...(template ? [{ kind: 'template', value: template.id }] : []),
    ];
    addRecord(
      makeRecord(
        id,
        'mission',
        name,
        {
          status: 'draft',
          priority: 'medium',
          owner: 'principal_chris',
          notes: notes.trim() || 'Created just now. No outcome written yet.',
          updated: new Date().toISOString(),
        },
        refs,
      ),
    );
    // A template brings its stages, so the new mission has a spine on arrival.
    const stageTitles = (template?.fields.stageTitles as string[] | undefined) ?? [];
    stageTitles.forEach((stageTitle, index) => {
      const stageId = `${id}_s${index + 1}`;
      addRecord(
        makeRecord(stageId, 'stage', stageTitle, {
          stageId,
          missionId: id,
          parentStageId: null,
          order: index + 1,
          status: 'planned',
          condition: `${stageTitle} is agreed and written down.`,
        }),
      );
    });
    setCreating(false);
    setTitle('');
    setNotes('');
    setTemplateId('');
    select(id);
    enterRoom({ kind: 'mission', subjectId: id });
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
              create();
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
                      {template.title} ({(template.fields.stageTitles as string[]).length} stages)
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="missions__create-actions">
              <ActionButton variant="primary" onClick={create}>
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
              const project = graph.relatedBy(mission.id, 'belongsTo').find((r) => r.kind === 'project');
              const stages = graph
                .relatedOfKind(mission.id, 'contains', 'stage')
                .filter((s) => !s.fields.parentStageId);
              const done = stages.filter((s) => field(s, 'status') === 'done').length;
              return (
                <ObjectCard
                  key={mission.id}
                  record={mission}
                  summary={field(mission, 'notes')}
                  meta={<StateChip state={field(mission, 'status')} />}
                  footer={
                    <>
                      <span>{project?.title ?? 'No project'}</span>
                      <span className="missions__reach">
                        {done}/{stages.length} stages
                      </span>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
