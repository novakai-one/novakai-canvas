import type {
  BenchConversationFrame,
  BenchInspectionTrail,
  BenchSessionSnapshot,
} from './bench-model';

let rememberedSession: BenchSessionSnapshot | null = null;

function copyTrail(trail: BenchInspectionTrail): BenchInspectionTrail {
  return {
    ...trail,
    steps: trail.steps.map((step) => ({ ...step })),
  };
}

function copyFrame(frame: BenchConversationFrame): BenchConversationFrame {
  return {
    ...frame,
    conversationIds: [...frame.conversationIds],
  };
}

function copySnapshot(snapshot: BenchSessionSnapshot): BenchSessionSnapshot {
  return {
    openThreadIds: [...snapshot.openThreadIds],
    trails: snapshot.trails.map(copyTrail),
    frames: snapshot.frames.map(copyFrame),
    scrollTopByThreadId: { ...snapshot.scrollTopByThreadId },
    focusedThreadId: snapshot.focusedThreadId,
  };
}

/** Reads semantic Bench state without retaining a mutable caller reference. */
export function readBenchSession(): BenchSessionSnapshot | null {
  return rememberedSession ? copySnapshot(rememberedSession) : null;
}

/** Remembers semantic Bench state without coordinates, viewport, or framework objects. */
export function rememberBenchSession(snapshot: BenchSessionSnapshot): void {
  rememberedSession = copySnapshot(snapshot);
}
