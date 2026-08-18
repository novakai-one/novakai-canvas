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
    pendingDraft: null,
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
      pendingDraft: session.pendingDraft ? { ...session.pendingDraft } : null,
    },
    zoomTier: 'mid',
  };
}

function setFrameMembership(
  session: BenchSessionSnapshot,
  threadId: string,
  frameId: string | null,
): BenchSessionSnapshot {
  return {
    ...session,
    frames: session.frames.map((frame) => {
      const withoutThread = frame.conversationIds.filter((id) => id !== threadId);
      return frame.id === frameId
        ? { ...frame, conversationIds: [...withoutThread, threadId] }
        : { ...frame, conversationIds: withoutThread };
    }),
  };
}

function createFrame(
  session: BenchSessionSnapshot,
  frame: BenchSessionSnapshot['frames'][number],
): BenchSessionSnapshot {
  if (session.frames.some((candidate) => candidate.id === frame.id)) return session;
  const members = new Set(frame.conversationIds);
  return {
    ...session,
    frames: [
      ...session.frames.map((candidate) => ({
        ...candidate,
        conversationIds: candidate.conversationIds.filter((id) => !members.has(id)),
      })),
      { ...frame, conversationIds: [...frame.conversationIds] },
    ],
  };
}

function pruneConversation(
  session: BenchSessionSnapshot,
  threadId: string,
): BenchSessionSnapshot {
  const { [threadId]: _removedScroll, ...remainingScroll } = session.scrollTopByThreadId;
  return {
    ...session,
    openThreadIds: session.openThreadIds.filter((id) => id !== threadId),
    trails: session.trails.filter((trail) => trail.threadId !== threadId),
    frames: session.frames.map((frame) => ({
      ...frame,
      conversationIds: frame.conversationIds.filter((id) => id !== threadId),
    })),
    scrollTopByThreadId: remainingScroll,
    focusedThreadId: session.focusedThreadId === threadId ? null : session.focusedThreadId,
  };
}

function reconcileSession(
  session: BenchSessionSnapshot,
  action: Extract<BenchAction, { type: 'reconcile-session' }>,
): BenchSessionSnapshot {
  const threadIds = new Set(action.threadIds);
  const messageIds = new Set(action.messageIds);
  const recordIds = new Set(action.recordIds);
  const scrollTopByThreadId = Object.fromEntries(Object.entries(session.scrollTopByThreadId)
    .filter(([threadId]) => threadIds.has(threadId)));
  return {
    ...session,
    openThreadIds: session.openThreadIds.filter((id) => threadIds.has(id)),
    trails: session.trails
      .filter((trail) => threadIds.has(trail.threadId) && messageIds.has(trail.rootMessageId))
      .map((trail) => ({
        ...trail,
        steps: trail.steps.filter((step) => (
          step.kind === 'relations'
            ? step.recordId !== null && messageIds.has(step.recordId)
            : step.recordId !== null && recordIds.has(step.recordId)
        )),
      }))
      .filter((trail) => trail.steps.length > 0),
    frames: session.frames.map((frame) => ({
      ...frame,
      conversationIds: frame.conversationIds.filter((id) => threadIds.has(id)),
    })),
    scrollTopByThreadId,
    focusedThreadId: session.focusedThreadId && threadIds.has(session.focusedThreadId)
      ? session.focusedThreadId
      : null,
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
    case 'create-draft':
      return session.pendingDraft
        ? state
        : { ...state, session: { ...session, pendingDraft: { id: action.draftId } } };
    case 'cancel-draft':
      return { ...state, session: { ...session, pendingDraft: null } };
    case 'accept-draft':
      return {
        ...state,
        session: {
          ...session,
          pendingDraft: null,
          openThreadIds: session.openThreadIds.includes(action.threadId)
            ? session.openThreadIds
            : [...session.openThreadIds, action.threadId],
          focusedThreadId: action.threadId,
        },
      };
    case 'create-frame':
      return { ...state, session: createFrame(session, action.frame) };
    case 'rename-frame':
      return {
        ...state,
        session: {
          ...session,
          frames: session.frames.map((frame) => (
            frame.id === action.frameId ? { ...frame, name: action.name } : frame
          )),
        },
      };
    case 'set-frame-membership':
      return { ...state, session: setFrameMembership(session, action.threadId, action.frameId) };
    case 'remove-frame':
      return {
        ...state,
        session: { ...session, frames: session.frames.filter((frame) => frame.id !== action.frameId) },
      };
    case 'clear-trails':
      return { ...state, session: { ...session, trails: [] } };
    case 'prune-conversation':
      return { ...state, session: pruneConversation(session, action.threadId) };
    case 'reconcile-session':
      return { ...state, session: reconcileSession(session, action) };
    case 'restore-session':
      return { ...state, session: createInitialBenchState(action.session).session };
  }
}
