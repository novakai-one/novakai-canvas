import type { StageDesign } from '../../stage-design';
import { CurrentStageSheet } from './CurrentStageSheet';

export const currentStageSheetDesign = {
  id: 'current',
  label: 'Current Stage Sheet',
  View: CurrentStageSheet,
} satisfies StageDesign;
