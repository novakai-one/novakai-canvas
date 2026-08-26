import type { Size } from '../../../contract/records/legacy.ts';
import { layoutAutomaticContainer } from './automatic-container.ts';
import { layoutExplicitContainer } from './explicit-container.ts';
import { resolveRequiredSize, type LayoutState } from './state.ts';

export function layoutContainer(state: LayoutState, containerId: string): Size {
  const arrangement = state.arrangementFor(containerId);
  const layoutNested = (nestedId: string): Size => layoutContainer(state, nestedId);
  const required = arrangement
    ? layoutExplicitContainer(state, containerId, arrangement, layoutNested)
    : layoutAutomaticContainer(state, containerId, layoutNested);
  return resolveRequiredSize(required, state.layout.placements[containerId]);
}
