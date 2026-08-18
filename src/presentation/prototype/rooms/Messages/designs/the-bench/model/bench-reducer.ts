import type {
  BenchAction,
  BenchInspectionTrail,
  BenchSessionSnapshot,
  BenchState,
  BenchTrailStep,
  BenchTrailStepId,
} from './bench-model';

/** Creates the empty semantic session used on a first visit. */
export function createEmptyBenchSession(): BenchSessionSnapshot {
  return {
    openThreadIds: [],
    trails: [],
    frames: [],
    scrollTopByThreadId: {},
    focusedThreadId: null,
  };
}

/** Creates reducer state from remembered semantics and an optional routed thread. */
export function createInitialBenchState(
  snapshot: BenchSessionSnapshot | null,
  initialThreadId?: string,
): BenchState {
  const session = snapshot ?? createEmptyBenchSession();
  const openThreadIds = initialThreadId && !session.openThreadIds.includes(initialThreadId)
    ? [...session.openThreadIds, initialThreadId]
    : [...session.openThreadIds];

  return {
    session: {
      ...session,
      openThreadIds,
      trails: session.trails.map((trail) => ({
        ...trail,
        steps: trail.steps.map((step) => ({ ...step })),
      })),
      frames: session.frames.map((frame) => ({
        ...frame,
        conversationIds: [...frame.conversationIds],
      })),
      scrollTopByThreadId: { ...session.scrollTopByThreadId },
    },
    zoomTier: 'mid',
  };
}

function trailIdentity(threadId: string, messageId: string): string {
  return `trail:${threadId}:${messageId}`;
}

function relationStepIdentity(trailId: string): string {
  return `${trailId}:relations`;
}

function inspectMessage(
  session: BenchSessionSnapshot,
  threadId: string,
  messageId: string,
): BenchSessionSnapshot {
  const id = trailIdentity(threadId, messageId);
  if (session.trails.some((trail) => trail.id === id)) return session;

  const relationStep: BenchTrailStep = {
    id: relationStepIdentity(id),
    kind: 'relations',
    parentStepId: null,
    recordId: messageId,
    relation: null,
  };
  const trail: BenchInspectionTrail = {
    id,
    threadId,
    rootMessageId: messageId,
    steps: [relationStep],
  };
  return { ...session, trails: [...session.trails, trail] };
}

function expandRelation(
  session: BenchSessionSnapshot,
  action: Extract<BenchAction, { type: 'expand-relation' }>,
): BenchSessionSnapshot {
  const stepId = `${action.parentStepId}:${action.relation}:${action.recordId}`;
  const trails = session.trails.map((trail) => {
    if (trail.id !== action.trailId || trail.steps.some((step) => step.id === stepId)) return trail;
    return {
      ...trail,
      steps: [...trail.steps, {
        id: stepId,
        kind: 'object' as const,
        parentStepId: action.parentStepId,
        recordId: action.recordId,
        relation: action.relation,
      }],
    };
  });
  return { ...session, trails };
}

function descendantStepIds(steps: readonly BenchTrailStep[], rootId: BenchTrailStepId): Set<string> {
  const removed = new Set<string>([rootId]);
  let foundAnother = true;
  while (foundAnother) {
    foundAnother = false;
    for (const step of steps) {
      if (step.parentStepId && removed.has(step.parentStepId) && !removed.has(step.id)) {
        removed.add(step.id);
        foundAnother = true;
      }
    }
  }
  return removed;
}

function closeTrailStep(
  session: BenchSessionSnapshot,
  trailId: string,
  stepId: string,
): BenchSessionSnapshot {
  const trail = session.trails.find((candidate) => candidate.id === trailId);
  if (!trail) return session;
  const removed = descendantStepIds(trail.steps, stepId);
  const remainingSteps = trail.steps.filter((step) => !removed.has(step.id));
  const trails = remainingSteps.length === 0
    ? session.trails.filter((candidate) => candidate.id !== trailId)
    : session.trails.map((candidate) => (
        candidate.id === trailId ? { ...candidate, steps: remainingSteps } : candidate
      ));
  return { ...session, trails };
}

/** Applies one semantic action without touching canvas or host state. */
export function reduceBenchState(state: BenchState, action: BenchAction): BenchState {
  const session = state.session;
  switch (action.type) {
    case 'open-conversation':
      return session.openThreadIds.includes(action.threadId)
        ? state
        : { ...state, session: { ...session, openThreadIds: [...session.openThreadIds, action.threadId] } };
    case 'collapse-conversation':
      return {
        ...state,
        session: {
          ...session,
          openThreadIds: session.openThreadIds.filter((id) => id !== action.threadId),
          trails: session.trails.filter((trail) => trail.threadId !== action.threadId),
          focusedThreadId: session.focusedThreadId === action.threadId ? null : session.focusedThreadId,
        },
      };
    case 'inspect-message':
      return { ...state, session: inspectMessage(session, action.threadId, action.messageId) };
    case 'expand-relation':
      return { ...state, session: expandRelation(session, action) };
    case 'close-trail-step':
      return { ...state, session: closeTrailStep(session, action.trailId, action.stepId) };
    case 'remember-scroll':
      return {
        ...state,
        session: {
          ...session,
          scrollTopByThreadId: { ...session.scrollTopByThreadId, [action.threadId]: action.scrollTop },
        },
      };
    case 'set-zoom-tier':
      return action.tier === state.zoomTier ? state : { ...state, zoomTier: action.tier };
    case 'focus-conversation':
      return { ...state, session: { ...session, focusedThreadId: action.threadId } };
    case 'clear-focus':
      return { ...state, session: { ...session, focusedThreadId: null } };
    case 'remove-frame':
      return {
        ...state,
        session: { ...session, frames: session.frames.filter((frame) => frame.id !== action.frameId) },
      };
  }
}
