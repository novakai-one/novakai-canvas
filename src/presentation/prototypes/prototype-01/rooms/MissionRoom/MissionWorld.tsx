/** Mission and Stage Worlds composed as a navigable execution section. */
import { type EdgeTypes, type NodeTypes } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './mission-world.css';
import { useStore } from '../../app/store';
import { WorldCanvas, type CanvasCameraRequest } from '../../components/canvas/WorldCanvas';
import { EmptyState } from '../../components/ui/ui';
import { layoutMissionWorld } from '../../interaction/reveal-tree';
import type { ObjectRecord } from '../../object-graph/contract';
import { childStages, rootStages } from '../../object-graph/graph';
import { missionGraphToFlow } from './graph-to-flow';
import { MissionStageInspector } from './MissionStageInspector';
import { MissionWorldScene } from './MissionWorldScene';
import { SectionalEdge } from './SectionalEdge';
import { SectionalStageNode } from './SectionalStageNode';
import { resolveMissionZoomTier, type MissionZoomTier } from './mission-semantic-zoom';

const missionNodeTypes = { 'sectional-stage': SectionalStageNode } satisfies NodeTypes;
const missionEdgeTypes = { sectional: SectionalEdge } satisfies EdgeTypes;
const heroFramedRooms = new Set<string>();

/** Mission and Stage rooms share this projection; only their subject and roots differ. */
export function MissionWorld({ subject, roots }: { subject: ObjectRecord; roots?: readonly ObjectRecord[] }) {
  const { graph, selected, select, enterRoom, revealed, toggleReveal, elected } = useStore();
  const [tier, setTier] = useState<MissionZoomTier>('working');
  const [cameraRequest, setCameraRequest] = useState<CanvasCameraRequest | null>(null);
  const cameraSequence = useRef(0);

  const sequence = useMemo(() => roots ?? rootStages(graph, subject.id), [graph, roots, subject.id]);
  const layout = useMemo(
    () => layoutMissionWorld(sequence, revealed, (id) => childStages(graph, id)),
    [graph, revealed, sequence],
  );
  const viewportKey = `${subject.kind}:${subject.id}`;

  useEffect(() => {
    if (subject.kind !== 'mission' || sequence.length === 0 || heroFramedRooms.has(viewportKey)) return;
    heroFramedRooms.add(viewportKey);
    cameraSequence.current += 1;
    setCameraRequest({
      key: `hero:${viewportKey}:${cameraSequence.current}`,
      nodeIds: sequence.map((stage) => stage.id),
      viewportInsets: { top: '9%', right: '8%', bottom: '9%', left: '8%' },
      maxZoom: 0.86,
      duration: 720,
    });
  }, [sequence, subject.kind, viewportKey]);

  const openStage = useCallback((id: string) => {
    enterRoom({ kind: 'stage', subjectId: id });
  }, [enterRoom]);

  const revealStage = useCallback((id: string) => {
    const opening = !revealed.includes(id);
    const children = childStages(graph, id);
    toggleReveal(id);

    if (opening && children.length > 0) {
      cameraSequence.current += 1;
      setCameraRequest({
        key: `reveal:${id}:${cameraSequence.current}`,
        nodeIds: [id, ...children.map((child) => child.id)],
        viewportInsets: {
          top: '12%',
          right: subject.kind === 'mission' ? '430px' : '12%',
          bottom: '12%',
          left: '10%',
        },
        maxZoom: 0.94,
        duration: 560,
      });
    }
  }, [graph, revealed, subject.kind, toggleReveal]);

  const flow = useMemo(
    () => missionGraphToFlow(layout, {
      selectedId: selected?.id ?? null,
      attentionId: elected?.subject.id ?? null,
      tier,
      reveal: revealStage,
      open: openStage,
    }),
    [elected?.subject.id, layout, openStage, revealStage, selected?.id, tier],
  );

  const selectedPlacement = layout.nodes.find((node) => node.record.id === selected?.id);
  const missionOwnsSelection = subject.kind === 'mission' && selected?.kind === 'stage' && selectedPlacement;

  if (sequence.length === 0) {
    return (
      <div className="mission-world mission-world--empty">
        <EmptyState>
          Nothing hangs here yet. Add the first stage to give this work a sequence to follow.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mission-world" data-tier={tier} data-selected={Boolean(missionOwnsSelection)}>
      <div className="mission-world__readout" aria-hidden="true">
        <span>Mission world / execution section</span>
        <strong>{subject.title}</strong>
      </div>
      <div className="mission-world__tier" aria-hidden="true">
        <span>Scale</span>
        <i data-active={tier === 'overview'}>Far</i>
        <i data-active={tier === 'working'}>Working</i>
        <i data-active={tier === 'detail'}>Near</i>
      </div>

      <WorldCanvas
        viewportKey={viewportKey}
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={missionNodeTypes}
        edgeTypes={missionEdgeTypes}
        selectedId={selected?.id ?? null}
        onSelect={select}
        onZoomChange={(zoom) => setTier((previous) => resolveMissionZoomTier(zoom, previous))}
        cameraRequest={cameraRequest}
        canvasChildren={(
          <MissionWorldScene
            layout={layout}
            selectedId={selected?.id ?? null}
            tier={tier}
            title={subject.title}
          />
        )}
      />

      {missionOwnsSelection && (
        <MissionStageInspector
          stageId={selected.id}
          sequenceLabel={selectedPlacement.sequenceLabel}
          onReveal={() => revealStage(selected.id)}
          onOpen={() => openStage(selected.id)}
        />
      )}
    </div>
  );
}
