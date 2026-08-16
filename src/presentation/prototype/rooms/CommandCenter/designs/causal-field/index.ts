import type { CommandCenterDesign } from '../../command-center-design';
import { CausalField } from './CausalField';

export const causalFieldDesign = {
  id: 'causal-field',
  label: 'Causal Field',
  ownsInspector: true,
  View: CausalField,
} satisfies CommandCenterDesign;
