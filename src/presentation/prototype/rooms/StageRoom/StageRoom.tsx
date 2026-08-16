/**
 * A Stage as the focused Room.
 *
 * Entering a Stage narrows the working context to that Stage and its own children; the
 * surrounding Mission is still one Back away, and the same two projections apply.
 *
 * The world projection renders through the host's branch below, ABOVE the design seam —
 * Stage designs only ever own the sheet projection, so this seam and the Mission World
 * seam never overlap.
 */
import { useStore } from '../../app/store';
import { childStages, field } from '../../object-graph/graph';
import { MissionWorld } from '../MissionRoom/MissionWorld';
import type { StageDesignCommands, StageDesignData } from './stage-design';
import { resolveStageDesign } from './stage-design-registry';

export function StageRoom({ stageId }: { stageId: string }) {
  const { graph, projection, selected, elected, select, enterRoom } = useStore();
  const stage = graph.get(stageId);
  if (!stage) return null;

  const children = childStages(graph, stageId);
  if (projection === 'world' && children.length > 0) {
    return <MissionWorld subject={stage} roots={children} />;
  }

  const design = resolveStageDesign(typeof window === 'undefined' ? '' : window.location.search);
  const DesignView = design.View;

  const data: StageDesignData = {
    graph,
    stage,
    conditionLine: field(stage, 'condition'),
    tasks: graph.relatedOfKind(stageId, 'contains', 'task'),
    childStages: children,
    blockers: graph.relatedBy(stageId, 'blockedBy'),
    selected,
    attentionSubjectId: elected?.subject.id ?? null,
  };

  const commands: StageDesignCommands = {
    select: (record) => select(record?.id ?? null),
    enterChildStage: (child) => enterRoom({ kind: 'stage', subjectId: child.id }),
  };

  return <DesignView data={data} commands={commands} />;
}
