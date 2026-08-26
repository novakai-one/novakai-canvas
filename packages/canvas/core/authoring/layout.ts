/**
 * CLI access to the canonical node sizing rule.
 *
 * Initial whole-diagram arrangement lives in `record-graph.layoutInitialRecord`; only per-card size
 * estimate is needed on its own, and it is the one part a snapshot renderer has to agree with.
 */
export { estimateNodeSize } from '../components/card/measure.ts';
