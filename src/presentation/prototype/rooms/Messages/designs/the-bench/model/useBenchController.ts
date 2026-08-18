import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from 'react';
import type {
  CanvasPlacementChange,
  CanvasNodePlacement,
  WorldPoint,
} from '../../../../../components/canvas/WorldCanvas';
import type { WorldCameraCommand, WorldViewport } from '../../../../../components/canvas/world-camera';
import type { ObjectId } from '../../../../../object-graph/contract';
import type { MessagesDesignCommands, MessagesDesignProps } from '../../../messages-design';
import { interpretBenchKey, resolveBenchZoomTier, type BenchKeyInput } from './bench-interaction';
import type { BenchAction, BenchModel, BenchNodeActions, BenchState } from './bench-model';
import { createInitialBenchState, reduceBenchState } from './bench-reducer';
import { readBenchSession, rememberBenchSession } from './bench-session-memory';
import {
  buildBenchModel,
  projectBenchCanvas,
  type BenchCanvasProjection,
} from './bench-projection';

/** Complete view-facing contract returned by the Bench orchestrator. */
export type BenchController = {
  readonly state: BenchState;
  readonly projection: BenchCanvasProjection;
  readonly selectedId: ObjectId | null;
  readonly cameraCommand: WorldCameraCommand | null;
  readonly actions: BenchNodeActions;
  readonly onCanvasSelect: (recordId: string | null) => void;
  readonly onPlacementChange: (change: CanvasPlacementChange) => void;
  readonly onViewportChange: (viewport: WorldViewport) => void;
  readonly onZoomChange: (zoom: number) => void;
  readonly onPaneDoubleClick: (position: WorldPoint) => void;
  readonly onKeyInput: (input: Omit<BenchKeyInput, 'currentZoom'>) => void;
};

function placementSignature(placements: readonly CanvasNodePlacement[]): string {
  return placements
    .map((placement) => `${placement.id}:${placement.position.x}:${placement.position.y}:${placement.parentId ?? ''}`)
    .sort()
    .join('|');
}

function useBenchPlacements(): {
  readonly placements: readonly CanvasNodePlacement[] | null;
  readonly onPlacementChange: (change: CanvasPlacementChange) => void;
} {
  const [placements, setPlacements] = useState<readonly CanvasNodePlacement[] | null>(null);
  const placementSignatureRef = useRef('');
  const onPlacementChange = useCallback((change: CanvasPlacementChange) => {
    const signature = placementSignature(change.placements);
    if (signature === placementSignatureRef.current) return;
    placementSignatureRef.current = signature;
    setPlacements(change.placements.map((placement) => ({
      ...placement,
      position: { ...placement.position },
    })));
  }, []);

  return { placements, onPlacementChange };
}

function useBenchNodeActions(
  commands: MessagesDesignCommands,
  model: BenchModel,
  dispatch: Dispatch<BenchAction>,
): BenchNodeActions {
  const commandsRef = useRef(commands);
  const modelRef = useRef(model);
  commandsRef.current = commands;
  modelRef.current = model;

  return useMemo<BenchNodeActions>(() => ({
    openConversation: (threadId) => {
      dispatch({ type: 'open-conversation', threadId });
      commandsRef.current.select(modelRef.current.recordsById.get(threadId) ?? null);
    },
    collapseConversation: (threadId) => dispatch({ type: 'collapse-conversation', threadId }),
    inspectMessage: (threadId, messageId) => {
      dispatch({ type: 'inspect-message', threadId, messageId });
      commandsRef.current.select(modelRef.current.recordsById.get(messageId) ?? null);
    },
    expandRelation: (trailId, parentStepId, relation, recordId) => {
      dispatch({ type: 'expand-relation', trailId, parentStepId, relation, recordId });
      commandsRef.current.select(modelRef.current.recordsById.get(recordId) ?? null);
    },
    closeTrailStep: (trailId, stepId) => dispatch({ type: 'close-trail-step', trailId, stepId }),
    selectRecord: (recordId) => commandsRef.current.select(
      recordId ? modelRef.current.recordsById.get(recordId) ?? null : null,
    ),
    canTravel: (recordId) => {
      const record = modelRef.current.recordsById.get(recordId);
      return record ? commandsRef.current.canOpen(record) : false;
    },
    travel: (recordId) => {
      const record = modelRef.current.recordsById.get(recordId);
      if (record && commandsRef.current.canOpen(record)) commandsRef.current.open(record);
    },
    sendMessage: (threadId, body) => {
      const trimmedBody = body.trim();
      if (trimmedBody) commandsRef.current.send(threadId, trimmedBody);
    },
    rememberTranscriptScroll: (threadId, scrollTop) => {
      dispatch({ type: 'remember-scroll', threadId, scrollTop });
    },
  }), [dispatch]);
}

function useBenchViewportPolicy(dispatch: Dispatch<BenchAction>) {
  const viewportRef = useRef<WorldViewport>({ x: 0, y: 0, zoom: 0.82 });
  const onViewportChange = useCallback((viewport: WorldViewport) => {
    viewportRef.current = { ...viewport };
  }, []);
  const onZoomChange = useCallback((zoom: number) => {
    dispatch({ type: 'set-zoom-tier', tier: resolveBenchZoomTier(zoom) });
  }, [dispatch]);

  return { viewportRef, onViewportChange, onZoomChange };
}

/** Coordinates host commands, semantic state, projection, and neutral canvas callbacks. */
export function useBenchController({ data, commands }: MessagesDesignProps): BenchController {
  const [state, dispatch] = useReducer(
    reduceBenchState,
    undefined,
    () => createInitialBenchState(readBenchSession(), data.initialThreadId),
  );
  const [cameraCommand, setCameraCommand] = useState<WorldCameraCommand | null>(null);
  const model = useMemo(() => buildBenchModel(data), [data]);
  const actions = useBenchNodeActions(commands, model, dispatch);
  const { placements, onPlacementChange } = useBenchPlacements();
  const { viewportRef, onViewportChange, onZoomChange } = useBenchViewportPolicy(dispatch);

  useEffect(() => {
    rememberBenchSession(state.session);
  }, [state.session]);

  const projection = useMemo(
    () => projectBenchCanvas(model, state, placements, actions),
    [actions, model, placements, state],
  );

  const onCanvasSelect = useCallback((recordId: string | null) => {
    actions.selectRecord(recordId);
  }, [actions]);

  const onKeyInput = useCallback((input: Omit<BenchKeyInput, 'currentZoom'>) => {
    const result = interpretBenchKey({ ...input, currentZoom: viewportRef.current.zoom });
    if (result.action) dispatch(result.action);
    if (result.cameraCommand) setCameraCommand(result.cameraCommand);
  }, [viewportRef]);

  const onPaneDoubleClick = useCallback((_position: WorldPoint) => {
    // Slice 2 turns this final neutral coordinate into a draft conversation.
  }, []);

  return {
    state,
    projection,
    selectedId: data.selected?.id ?? null,
    cameraCommand,
    actions,
    onCanvasSelect,
    onPlacementChange,
    onViewportChange,
    onZoomChange,
    onPaneDoubleClick,
    onKeyInput,
  };
}
