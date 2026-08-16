import type { CommandCenterDesign } from '../../command-center-design';
import { CausalLoom } from './CausalLoom';

export const causalLoomDesign = {
  id: 'causal-loom',
  label: 'Causal Loom',
  ownsInspector: true,
  View: CausalLoom,
} satisfies CommandCenterDesign;
