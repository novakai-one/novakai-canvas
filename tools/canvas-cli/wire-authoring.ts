/** Typed relationship contract shared by Canvas DSL parsing, compilation and link persistence. */

import type { WireKind } from '../../src/domain/records.ts';
import type { WireAppearance } from '../../src/domain/wire-appearance.ts';

/** Relationship declaration including its source line for compiler failures. */
export interface WireAst {
  source: string;
  target: string;
  contract: string;
  kind: WireKind;
  appearance?: WireAppearance;
  line: number;
}

/** One resolved relationship end, named by owning diagram and node identity. */
export interface LinkEnd { diagramId: string; nodeId: string }

/** A relationship whose resolved ends live in different diagrams. */
export interface CrossDiagramWire {
  kind: WireKind;
  label: string;
  source: LinkEnd;
  target: LinkEnd;
}
