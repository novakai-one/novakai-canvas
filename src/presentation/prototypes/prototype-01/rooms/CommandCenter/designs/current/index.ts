import type { CommandCenterDesign } from '../../command-center-design';
import { CurrentCommandCenter } from './CurrentCommandCenter';

/** The original list-based Command Center retained as the default design. */
export const currentCommandCenterDesign = {
  id: 'current',
  label: 'Current Command Center',
  View: CurrentCommandCenter,
} satisfies CommandCenterDesign;
