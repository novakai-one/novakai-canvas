/**
 * `group` nodes are containers (DSL keyword `zone`); their real size comes from laying out their
 * children (`src/domain/layout.ts` recursion), unchanged by this registry seam. `measure` only
 * supplies the floor a newly created, still-empty group starts from.
 */

import type { DiagramComponent } from '../component.ts';

export const groupComponent: DiagramComponent<'group'> = {
  kind: 'group',
  dslKeyword: 'zone',
  layoutRole: 'container',
  measure: () => ({ width: 320, height: 160 }),
};
