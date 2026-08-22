import type { ContainerArrangement } from '../canvas-presentation.ts';

/** Authored arrangement after geometry has resolved its minimum spacing policy. */
export type ResolvedContainerArrangement = Omit<ContainerArrangement, 'gap'> & { gap: number };
