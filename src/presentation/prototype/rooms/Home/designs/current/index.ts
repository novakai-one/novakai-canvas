import type { HomeDesign } from '../../home-design';
import { CurrentHome } from './CurrentHome';

export const currentHomeDesign = {
  id: 'current',
  label: 'Current Home',
  View: CurrentHome,
} satisfies HomeDesign;
