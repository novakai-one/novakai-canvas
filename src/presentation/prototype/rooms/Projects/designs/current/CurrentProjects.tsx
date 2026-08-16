/**
 * The original Projects board, preserved as the default registered design.
 *
 * The project↔mission relationship runs both ways off one stored ref: a project lists
 * its missions here, and each mission's inspector opens back to its project. Neither
 * side keeps a copy.
 */
import { useState } from 'react';
import './current-projects.css';
import { ActionButton } from '../../../../components/ui/ui';
import type { ProjectsDesignProps } from '../../projects-design';
import { ProjectColumn } from './ProjectColumn';

/** Existing Projects board UI translated to the stable room design contract. */
export function CurrentProjects({ data, commands }: ProjectsDesignProps) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const submitProject = () => {
    commands.createProject({ title: name });
    setName('');
    setNaming(false);
  };

  return (
    <div className="projects">
      <div className="projects__board">
        {data.projects.map((project) => (
          <ProjectColumn key={project.id} project={project} data={data} commands={commands} />
        ))}

        <section className="projects__new">
          {naming ? (
            <form
              className="projects__new-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitProject();
              }}
            >
              <input
                className="project-column__draft-input"
                value={name}
                autoFocus
                placeholder="Project name"
                onChange={(event) => setName(event.target.value)}
              />
              <ActionButton variant="primary" onClick={submitProject}>
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
