import { createDesignRegistry } from '../../designs/design-registry';
import { currentProjectsDesign } from './designs/current';
import type { ProjectsDesign, ProjectsDesignProps } from './projects-design';

const projectsDesignRegistry = createDesignRegistry<ProjectsDesignProps>(
  [currentProjectsDesign],
  currentProjectsDesign.id,
);

/** Lists every design available to the Projects selector. */
export function listProjectsDesigns(): readonly ProjectsDesign[] {
  return projectsDesignRegistry.list();
}

/** Resolves the URL design ID with a deliberate fallback to the current Projects board. */
export function resolveProjectsDesign(search: string): ProjectsDesign {
  const requestedId = new URLSearchParams(search).get('projectsDesign');
  return projectsDesignRegistry.resolve(requestedId);
}
