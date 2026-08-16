import type { ProjectsDesign } from '../../projects-design';
import { CurrentProjects } from './CurrentProjects';

export const currentProjectsDesign = {
  id: 'current',
  label: 'Current Projects Board',
  View: CurrentProjects,
} satisfies ProjectsDesign;
