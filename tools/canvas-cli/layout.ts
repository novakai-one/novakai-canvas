/**
 * CLI access to the canonical node sizing rule.
 *
 * Arranging a whole diagram lives in `record-graph.layoutRecord`; only the per-card size
 * estimate is needed on its own, and it is the one part a snapshot renderer has to agree with.
 */
export { estimateNodeSize } from '../../src/domain/layout.ts';
