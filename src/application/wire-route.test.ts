import { describe, expect, it } from 'vitest';
import {
  createCanvasWorkspace, diagramRecordSchema, migrateDocumentToLibrary,
  type ActorContext, type DiagramRecord, type RecordCommand,
} from '../canvas';
import { parseArchitectureDocument } from '../domain/schema';
import working from '../domain/migrate/fixtures/real-v2-working-copy.json' with { type: 'json' };

/**
 * The route command through the public surface only.
 *
 * A host shapes a wire by sending an intention; it never edits a layout. These tests use the
 * same entry point the browser uses, so a passing test cannot mean anything a user cannot do.
 */

const human: ActorContext = {
  actor: { id: 'local-user', kind: 'human' },
  provenance: { source: 'ui' },
};

function openMessagingScope(): DiagramRecord {
  const library = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));
  return library.records['messaging-scope'];
}

function activeHints(record: DiagramRecord) {
  return record.layouts[record.views[record.activeViewId].layoutId].wireRouteHints;
}

function anyWireId(record: DiagramRecord): string {
  const id = Object.keys(record.wires)[0];
  if (!id) throw new Error('fixture has no wires');
  return id;
}

function setRoute(id: string, route: Record<string, unknown>): RecordCommand {
  return { kind: 'wire.setRoute', id, route } as RecordCommand;
}

describe('wire.setRoute', () => {
  it('stores waypoints on the active layout for the named wire', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const wireId = anyWireId(workspace.snapshot());

    const outcome = workspace.execute(setRoute(wireId, {
      waypoints: [{ x: 120, y: 240 }, { x: 320, y: 240 }],
    }));

    expect(outcome.status).toBe('applied');
    expect(activeHints(workspace.snapshot())[wireId]).toMatchObject({
      wireId, waypoints: [{ x: 120, y: 240 }, { x: 320, y: 240 }],
    });
  });

  it('stores a label position along the wire', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const wireId = anyWireId(workspace.snapshot());

    workspace.execute(setRoute(wireId, { labelPosition: 0.25 }));

    expect(activeHints(workspace.snapshot())[wireId].labelPosition).toBe(0.25);
  });

  it('merges: setting a label position keeps waypoints already placed', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const wireId = anyWireId(workspace.snapshot());

    workspace.execute(setRoute(wireId, { waypoints: [{ x: 10, y: 20 }] }));
    workspace.execute(setRoute(wireId, { labelPosition: 0.8 }));

    expect(activeHints(workspace.snapshot())[wireId]).toMatchObject({
      waypoints: [{ x: 10, y: 20 }], labelPosition: 0.8,
    });
  });

  it('clears waypoints when given an empty list', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const wireId = anyWireId(workspace.snapshot());

    workspace.execute(setRoute(wireId, {
      waypoints: [{ x: 10, y: 20 }],
      preferredSourceSide: 'right', preferredTargetSide: 'left',
    }));
    workspace.execute(setRoute(wireId, {
      waypoints: [], preferredSourceSide: null, preferredTargetSide: null,
    }));

    expect(activeHints(workspace.snapshot())[wireId].waypoints).toEqual([]);
    expect(activeHints(workspace.snapshot())[wireId]).not.toHaveProperty('preferredSourceSide');
    expect(activeHints(workspace.snapshot())[wireId]).not.toHaveProperty('preferredTargetSide');
  });

  it('rejects a route for a wire that does not exist', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);

    const outcome = workspace.execute(setRoute('no-such-wire', { labelPosition: 0.5 }));

    expect(outcome).toMatchObject({ status: 'rejected', reason: 'wire-not-found:no-such-wire' });
  });

  it('rejects a label position outside the wire', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const wireId = anyWireId(workspace.snapshot());

    expect(workspace.execute(setRoute(wireId, { labelPosition: 1.4 })).status).toBe('rejected');
    expect(workspace.execute(setRoute(wireId, { labelPosition: -0.1 })).status).toBe('rejected');
    expect(activeHints(workspace.snapshot())[wireId]).toBeUndefined();
  });

  it('rejects a waypoint that is not a finite position', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const wireId = anyWireId(workspace.snapshot());

    const outcome = workspace.execute(setRoute(wireId, {
      waypoints: [{ x: Number.NaN, y: 0 }],
    }));

    expect(outcome.status).toBe('rejected');
  });

  it('leaves a record the schema still accepts', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const wireId = anyWireId(workspace.snapshot());

    workspace.execute(setRoute(wireId, {
      waypoints: [{ x: 1, y: 2 }], labelPosition: 0.3, preferredSourceSide: 'right',
    }));

    expect(() => diagramRecordSchema.parse(workspace.snapshot())).not.toThrow();
  });

  it('forgets the route when the wire is removed', () => {
    const workspace = createCanvasWorkspace(openMessagingScope(), human);
    const wireId = anyWireId(workspace.snapshot());

    workspace.execute(setRoute(wireId, { labelPosition: 0.4 }));
    workspace.execute({ kind: 'wire.remove', id: wireId });

    expect(activeHints(workspace.snapshot())[wireId]).toBeUndefined();
  });
});
