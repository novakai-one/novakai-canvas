/**
 * `group` nodes are containers (DSL keyword `zone`); their real size comes from laying out their
 * children (`src/domain/layout.ts` recursion), unchanged by this registry seam. `measure` only
 * supplies the floor a newly created, still-empty group starts from.
 */

import { namedNodeDeclaration, type DiagramComponent } from '../component.ts';

const zoneDeclaration = namedNodeDeclaration('zone', 'Stores', 'Persistent data');

export const groupComponent: DiagramComponent<'group'> = {
  kind: 'group',
  dslKeyword: 'zone',
  declaration: {
    ...zoneDeclaration,
    syntax: `${zoneDeclaration.syntax} ... end`,
    example: 'zone "Stores" "Persistent data"\n  resource "missions.json"\nend',
  },
  arrangementModes: ['stack', 'row', 'grid'],
  layoutRole: 'container',
  measure: () => ({ width: 320, height: 160 }),
};
