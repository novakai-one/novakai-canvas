/**
 * `group` nodes are containers (DSL keyword `zone`); their real size comes from laying out their
 * children (`src/domain/layout.ts` recursion), unchanged by this registry seam. `measure` only
 * supplies the floor a newly created, still-empty group starts from.
 */

import type { DiagramComponent } from '../component.ts';

export const groupComponent: DiagramComponent<'group'> = {
  kind: 'group',
  dslKeyword: 'zone',
  helpLines: [
    'zones         zone "Stores" ... end                nested containers; zones nest',
    '              inside scopes and inside each other; labels unique per map',
  ],
  layoutRole: 'container',
  measure: () => ({ width: 320, height: 160 }),
};
