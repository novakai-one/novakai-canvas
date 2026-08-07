# Canvas Gesture Fixes + Diagram Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three canvas bugs on `main`: (1) resize from a north/west edge grows the box down-right instead of moving the dragged edge, (3) dragging shows no visual feedback until drop, (2) diagrams cannot be renamed and are always created as "Untitled diagram".

**Architecture:** Bugs 1+3 share one root cause — commit `d5f5980` stopped applying per-frame position updates so undo stayed clean, but React Flow is controlled, so nothing renders mid-gesture and resizer position compensation is discarded. The fix separates render state from record state: an **in-flight overlay** (`src/presentation/in-flight.ts`) holds gesture frames for rendering only; the record gets **one batched commit per gesture** via the existing `executeAll` (App.tsx:118). Bug 2 is an affordance gap: `diagram.rename` exists and is tested but is only reachable as a hidden side effect of renaming the root node's label; the fix gives the no-selection Diagram inspection a `rename` (batched with the root label via `executeAll`) and auto-focuses the title after creation.

**Tech Stack:** React 19, @xyflow/react 12.11.2, TypeScript, Vitest, Vite.

## Global Constraints

- **Execute in a fresh worktree off `main`**, created via superpowers:using-git-worktrees. Do NOT work in the `canvas-record-model` worktree (its HEAD is an ancestor of `main`; the bugs live on `main`). Carry this plan file to the execution worktree.
- Never hand-edit `public/data/*.json`; never write coordinates into semantic records.
- After every task: `npm run check` must pass, then commit. Match the codebase's comment style (explanatory "why" comments on non-obvious decisions).
- Browser verification is required before sealing (AGENTS.md: "Inspect interactions in a real browser"). Dev server: `npm run dev`, open `http://localhost:5173` (IPv6, not 127.0.0.1).
- Keep changes minimal. No refactors beyond what a task states.

## Background: exact current code (verified on `main`)

- `applyNodeChanges` (`src/presentation/components/canvas-surface.tsx`, module-level) currently **ignores `position` changes entirely** and executes `node.resize` per frame for `dimensions` changes with `resizing: true`. `remove` executes immediately.
- `onNodeDragStop` (canvas-surface.tsx, in the `<ReactFlow>` props) calls `applyDrop(execute, view, { id, parentId, position })` which executes `node.reparent` (if the drop target changed) + `node.move`.
- NodeResizer (@xyflow/react) emits, per resize frame: a `dimensions` change (`resizing: true`) AND, for north/west/corner handles, a `position` change. The discarded position change is why the anchor pins (bug 1).
- `projectNodes` (`src/presentation/projection.ts:356`) builds `Node<ArchitectureNodeData>[]` with top-level `position`, `width`, `height`; `ProjectionInput` (projection.ts:267) carries `execute?` and is how callbacks reach node `data`.
- The four resizable node components each render a bare `<NodeResizer isVisible={...} .../>`: `scope-node.tsx:20`, `architecture-node.tsx:77`, `comment-node.tsx:10`, `tree-node.tsx:24`.
- `executeAll` (App.tsx:118) submits a command batch as **one revision = one undo** via `workspace.submit`.
- `diagramInspection` (`src/presentation/components/inspect-panel.tsx`) currently returns no `rename`. `nodeInspection.rename` (same file) already dispatches `node.update` + (when root) `diagram.rename`. `PanelHeader` (`src/presentation/shell/panel-header.tsx`) renders an editable title input when `rename` is present.
- `createDiagram` (App.tsx:205) hardcodes `'Untitled diagram'`, then selects the new root group.
- Allow-lists: `tools/canvas-cli/cli.ts:63-65` already includes `'diagram.rename'`; the `commandKinds` enum in `src/domain/schema.ts:64-70` does **not** — a record whose provenance names `diagram.rename` fails schema validation. That is the landmine.

---

### Task 1: In-flight overlay module (pure, tested)

**Files:**
- Create: `src/presentation/in-flight.ts`
- Test: `src/presentation/in-flight.test.ts`

**Interfaces:**
- Consumes: `NodeChange` and `Node` from `@xyflow/react`.
- Produces (later tasks rely on these exact names):
  - `interface InFlightFrame { position?: { x: number; y: number }; size?: { width: number; height: number } }`
  - `type InFlight = Readonly<Record<string, InFlightFrame>>`
  - `applyFrame(inFlight: InFlight, change: NodeChange): InFlight`
  - `mergeInFlight<T extends Node>(nodes: T[], inFlight: InFlight): T[]`
  - `clearInFlight(inFlight: InFlight, id: string): InFlight`

- [ ] **Step 1: Write the failing test**

```ts
// src/presentation/in-flight.test.ts
import { describe, expect, it } from 'vitest';
import type { Node, NodeChange } from '@xyflow/react';
import { applyFrame, clearInFlight, mergeInFlight, type InFlight } from './in-flight';

const node = (id: string, x = 0, y = 0): Node =>
  ({ id, position: { x, y }, width: 100, height: 80, data: {} }) as Node;

describe('in-flight overlay', () => {
  it('records position frames so a node moves while it is dragged', () => {
    const change = { id: 'a', type: 'position', position: { x: 40, y: 25 }, dragging: true } as NodeChange;
    const frames = applyFrame({}, change);
    const [drawn] = mergeInFlight([node('a')], frames);
    expect(drawn.position).toEqual({ x: 40, y: 25 });
  });

  it('records size frames only for user resizes, never initial measurements', () => {
    const measure = { id: 'a', type: 'dimensions', dimensions: { width: 100, height: 80 } } as NodeChange;
    const resize = { id: 'a', type: 'dimensions', dimensions: { width: 300, height: 200 }, resizing: true } as NodeChange;
    expect(applyFrame({}, measure)).toEqual({});
    const [drawn] = mergeInFlight([node('a')], applyFrame({}, resize));
    expect(drawn.width).toBe(300);
    expect(drawn.height).toBe(200);
  });

  it('leaves nodes with no frame untouched', () => {
    const frames = applyFrame({}, { id: 'a', type: 'position', position: { x: 9, y: 9 }, dragging: true } as NodeChange);
    const [untouched] = mergeInFlight([node('b', 1, 2)], frames);
    expect(untouched.position).toEqual({ x: 1, y: 2 });
  });

  it('forgets a node when it is removed mid-gesture', () => {
    let frames: InFlight = applyFrame({}, { id: 'a', type: 'position', position: { x: 5, y: 5 }, dragging: true } as NodeChange);
    frames = applyFrame(frames, { id: 'a', type: 'remove' } as NodeChange);
    expect(frames).toEqual({});
  });

  it('clears one entry without touching the rest', () => {
    let frames: InFlight = applyFrame({}, { id: 'a', type: 'position', position: { x: 5, y: 5 }, dragging: true } as NodeChange);
    frames = applyFrame(frames, { id: 'b', type: 'position', position: { x: 7, y: 7 }, dragging: true } as NodeChange);
    expect(Object.keys(clearInFlight(frames, 'a'))).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/presentation/in-flight.test.ts`
Expected: FAIL — module `./in-flight` does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/presentation/in-flight.ts
import type { Node, NodeChange } from '@xyflow/react';

/**
 * Gesture frames that have not happened yet, as far as the record is concerned.
 *
 * React Flow is controlled: it only draws a node where the `nodes` prop says, so a drag or
 * resize is invisible until the host feeds each frame back. The record must not hear those
 * frames — one gesture is one undoable act (d5f5980) — so they live here instead: rendered
 * immediately, committed once when the gesture ends, discarded if it is cancelled.
 */
export interface InFlightFrame {
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export type InFlight = Readonly<Record<string, InFlightFrame>>;

/** Folds one React Flow change into the overlay. Anything that is not a gesture frame is ignored. */
export function applyFrame(inFlight: InFlight, change: NodeChange): InFlight {
  if (change.type === 'position' && change.position) {
    return { ...inFlight, [change.id]: { ...inFlight[change.id], position: change.position } };
  }
  // Only user-driven resizes carry `resizing` — React Flow's initial DOM measurements must
  // not become frames, or every stored size would be rewritten by what the DOM happens to say.
  if (change.type === 'dimensions' && change.dimensions && change.resizing) {
    return { ...inFlight, [change.id]: { ...inFlight[change.id], size: change.dimensions } };
  }
  if (change.type === 'remove') return clearInFlight(inFlight, change.id);
  return inFlight;
}

/** Draws each node where the gesture has it, leaving everything else exactly as projected. */
export function mergeInFlight<T extends Node>(nodes: T[], inFlight: InFlight): T[] {
  if (Object.keys(inFlight).length === 0) return nodes;
  return nodes.map((node) => {
    const frame = inFlight[node.id];
    if (!frame) return node;
    return {
      ...node,
      position: frame.position ?? node.position,
      width: frame.size?.width ?? node.width,
      height: frame.size?.height ?? node.height,
    };
  });
}

/** Drops one node's frames — the gesture ended, one way or another. */
export function clearInFlight(inFlight: InFlight, id: string): InFlight {
  if (!(id in inFlight)) return inFlight;
  const next = { ...inFlight };
  delete next[id];
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/presentation/in-flight.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: `npm run check`, then commit**

```bash
npm run check
git add src/presentation/in-flight.ts src/presentation/in-flight.test.ts
git commit -m "feat(canvas): an in-flight overlay holds gesture frames the record must not hear"
```

---

### Task 2: Route gesture frames through the overlay (drag preview)

**Files:**
- Modify: `src/presentation/components/canvas-surface.tsx` — `applyNodeChanges`, the `nodes` memo, `onNodeDragStop`, plus component state
- Test: `src/presentation/in-flight.test.ts` (no new tests here; wiring is verified in the browser)

**Interfaces:**
- Consumes: `applyFrame`, `mergeInFlight`, `clearInFlight`, `InFlight` from Task 1; existing `applyDrop(execute, view, moved)` in the same file.
- Produces: position changes no longer die in `applyNodeChanges`; `onNodeDragStop` clears the dragged node's overlay entry after committing.

- [ ] **Step 1: Hold the overlay in state and clear it between diagrams**

In the `CanvasSurface` component, near the other hooks:

```tsx
const [inFlight, setInFlight] = useState<InFlight>({});
// A leftover frame from another diagram would drag a ghost across the switch.
useEffect(() => setInFlight({}), [activeDiagramId]);
```

Add `import { applyFrame, clearInFlight, mergeInFlight, type InFlight } from '../in-flight';` and `useEffect`/`useState` to the React import as needed.

- [ ] **Step 2: `applyNodeChanges` writes frames to the overlay instead of discarding them**

Replace the module-level `applyNodeChanges` with one that routes frames:

```tsx
/*
 * Gesture frames go to the in-flight overlay, not the record: React Flow is controlled,
 * so the overlay is what lets a drag or resize be seen while it happens, and keeping the
 * frames out of `execute` is what keeps one gesture one undoable act (d5f5980). The
 * position that becomes a fact is the one drag-stop / resize-end resolves. Removals are
 * not a gesture — they execute immediately, as before.
 */
function applyNodeChanges(
  execute: (command: RecordCommand) => void,
  frame: (change: NodeChange) => void,
  changes: NodeChange[],
): void {
  changes.forEach((change) => {
    if (change.type === 'remove') { execute({ kind: 'node.remove', id: change.id }); return; }
    frame(change);
  });
}
```

Call site (in the `<ReactFlow>` props) becomes:

```tsx
onNodesChange={(changes) => {
  if (editable) applyNodeChanges(execute, (change) => setInFlight((current) => applyFrame(current, change)), changes);
}}
```

- [ ] **Step 3: Merge the overlay into the rendered nodes**

```tsx
const nodes = useMemo(
  () => mergeInFlight(
    projectNodes({ view, record, preferences, selection, editable, select: setSelection, execute }),
    inFlight,
  ),
  [editable, execute, inFlight, preferences, record, selection, setSelection, view],
);
```

- [ ] **Step 4: `onNodeDragStop` commits, then clears the entry**

```tsx
onNodeDragStop={(_event, node) => {
  if (!editable) return;
  applyDrop(execute, view, { id: node.id, parentId: node.parentId, position: node.position });
  // The drop is a fact now; the frames that previewed it must not linger as a ghost.
  setInFlight((current) => clearInFlight(current, node.id));
}}
```

- [ ] **Step 5: `npm run check`, then browser-verify the drag**

Run: `npm run check` and `npm run dev`. In `http://localhost:5173`: drag a module, a group (by its title), and a comment — each must track the pointer live and land where released. Press undo once: the whole drag must come back in one step. Escape mid-drag must not leave a ghost (if it does, add the clearing path before continuing).

- [ ] **Step 6: Commit**

```bash
git add src/presentation/components/canvas-surface.tsx
git commit -m "fix(canvas): drags draw through the in-flight overlay and commit once on release"
```

---

### Task 3: Resize commits position + size as one undo

**Files:**
- Modify: `src/presentation/projection.ts` — `ProjectionInput` (~:267) and `projectNodes` data block (~:400)
- Modify: `src/presentation/nodes/scope-node.tsx:20`, `architecture-node.tsx:77`, `comment-node.tsx:10`, `tree-node.tsx:24`
- Modify: `src/presentation/components/canvas-surface.tsx` — supply `resizeEnd`, stop committing resize frames
- Test: `src/application/canvas-workspace.test.ts` (add one batch-undo test)

**Interfaces:**
- Consumes: `InFlight` overlay from Tasks 1-2; `executeAll` prop already on `CanvasSurfaceProps` (:44); `ArchitectureNodeData` in projection.ts.
- Produces: `ProjectionInput.resizeEnd?: (id: string) => void`, surfaced as `data.resizeEnd` on every node; the workspace test `undo of a move+resize batch restores both facts`.

- [ ] **Step 1: Write the failing batch-undo test**

Add to `src/application/canvas-workspace.test.ts` (mirror the existing `op-undo` batch test at :77 for setup style):

```ts
it('undoes a move+resize batch as one gesture', () => {
  // ...open a workspace with one placed node, then:
  const before = workspace.snapshot();
  const moved = { x: 50, y: 60 };
  const resized = { width: 400, height: 300 };
  workspace.submit({
    operationId: 'op-resize',
    expectedRevision: before.revision,
    timestamp: new Date().toISOString(),
    commands: [
      { kind: 'node.move', id: nodeId, position: moved },
      { kind: 'node.resize', id: nodeId, size: resized },
    ],
  });
  workspace.undo();
  const after = workspace.snapshot();
  // placement position and size both back to `before` values
});
```

- [ ] **Step 2: Run it — expect it to fail or pass?**

Run: `npx vitest run src/application/canvas-workspace.test.ts`
Expected: likely PASS already (the workspace has always batched correctly — this test pins the behaviour the fix relies on, per the agreed test formulation). If it fails, STOP: the batching assumption is wrong and Task 3's design must be revisited before touching the UI.

- [ ] **Step 3: Thread `resizeEnd` through the projection**

In `projection.ts` `ProjectionInput` add:

```ts
/** A resize gesture ended; the host commits the accumulated frame as one revision. */
resizeEnd?: (id: string) => void;
```

In `projectNodes`'s returned `data` block add:

```ts
resizeEnd: input.resizeEnd && editable ? input.resizeEnd : undefined,
```

Add `resizeEnd?: (id: string) => void;` to `ArchitectureNodeData`.

- [ ] **Step 4: Wire `onResizeEnd` in all four node components**

Same one-line change in `scope-node.tsx`, `architecture-node.tsx`, `comment-node.tsx`, `tree-node.tsx`:

```tsx
<NodeResizer isVisible={...existing...} minHeight={...} minWidth={...} onResizeEnd={() => data.resizeEnd?.(data.node.id as string)} />
```

(Comment and scope nodes destructure `data` slightly differently — match each file's existing access to the node id.)

- [ ] **Step 5: Commit the gesture from the overlay in `canvas-surface.tsx`**

Supply `resizeEnd` in the `projectNodes` call, and stop executing resize frames (they are overlay frames now — the `dimensions` branch of the old `applyNodeChanges` is gone, handled by `applyFrame`):

```tsx
// A resize moves two facts for north/west handles — where the corner sits and how big the
// box is — and one fact for the rest. Either way it is one gesture, so it commits as one
// revision through executeAll, straight from the frames the overlay accumulated. The
// resizer's own onResizeEnd params are deliberately unused: the overlay holds the same
// values React Flow reported, already in node.position coordinates.
resizeEnd: editable
  ? (id: string) => {
    const frame = inFlight[id];
    if (!frame) return;
    props.executeAll([
      ...(frame.position ? [{ kind: 'node.move' as const, id, position: frame.position }] : []),
      ...(frame.size ? [{ kind: 'node.resize' as const, id, size: frame.size }] : []),
    ]);
    setInFlight((current) => clearInFlight(current, id));
  }
  : undefined,
```

Add `inFlight` and `props.executeAll` to the memo deps accordingly.

- [ ] **Step 6: `npm run check`, then browser-verify resize**

`npm run check`; dev server. For a module AND a group: drag each of the top, left, and top-left handles — the dragged edge must follow the pointer while the opposite edge stays put. Drag the bottom-right handle — unchanged behaviour. One undo after each resize must restore the original box in a single step. Reload the page: sizes and positions must persist.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/projection.ts src/presentation/nodes/ src/presentation/components/canvas-surface.tsx src/application/canvas-workspace.test.ts
git commit -m "fix(canvas): a resize commits its corner and its size as one undoable act"
```

---

### Task 4: The diagram itself is renameable in the Studio

**Files:**
- Modify: `src/presentation/components/inspect-panel.tsx` — `diagramInspection`, `InspectPanelProps`
- Modify: `src/presentation/components/inspector.tsx` — pass `executeAll` through
- Modify: `src/App.tsx` — pass `executeAll` to the inspector
- Modify: `src/domain/schema.ts:64-70` — add `'diagram.rename'` to the `commandKinds` enum
- Test: `src/presentation/components/inspection-shape.test.ts`

**Interfaces:**
- Consumes: `executeAll` (App.tsx:118); `rootGroupId` (already imported in inspect-panel).
- Produces: `InspectPanelProps.executeAll: (commands: RecordCommand[]) => void`; `diagramInspection` returns a `rename` when editable.

- [ ] **Step 1: Write the failing test**

In `inspection-shape.test.ts`, alongside the existing rename test (:67):

```ts
it('the diagram itself renames through the header, keeping the root frame caption in step', () => {
  const batches: RecordCommand[][] = [];
  const props = makeInspectProps({ /* editable, a record with a root group */ });
  props.executeAll = (commands) => batches.push(commands);
  const inspection = diagramInspectionForTest(props); // whatever accessor the file already uses
  expect(inspection.rename).toBeTypeOf('function');
  inspection.rename?.('Agent Messaging');
  expect(batches).toEqual([[
    { kind: 'diagram.rename', name: 'Agent Messaging' },
    { kind: 'node.update', id: rootId, patch: { label: 'Agent Messaging' } },
  ]]);
});
```

(Adapt to the test file's existing fixtures — it already builds inspection props and asserts `rename` is a function for nodes.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/presentation/components/inspection-shape.test.ts`
Expected: FAIL — `rename` is undefined on the diagram inspection.

- [ ] **Step 3: Implement**

In `inspect-panel.tsx`:

```ts
function diagramInspection(props: InspectPanelProps): Inspection {
  const rootId = rootGroupId(props.record);
  return {
    kind: 'Diagram',
    title: props.record.name,
    meta: '',
    /*
     * The record owns the diagram's name and the root frame wears it on the canvas, so one
     * edit writes both — batched, because one rename is one undoable act. This is the same
     * pairing nodeInspection makes for the root node; the diagram just never had a door in.
     */
    rename: props.editable && rootId
      ? (label: string) => {
        const name = label.trim();
        if (name.length === 0) return;
        props.executeAll([
          { kind: 'diagram.rename', name },
          { kind: 'node.update', id: rootId, patch: { label: name } },
        ]);
      }
      : undefined,
    trail: [{ label: props.record.name, select: null }],
    sections: [],
    body: (
      <div className="panel-idle">
        <span>Select an object to inspect it.</span>
      </div>
    ),
  };
}
```

Add `executeAll: (commands: RecordCommand[]) => void;` to `InspectPanelProps`; pass it in `inspector.tsx` from its own props and in `App.tsx` from the existing `executeAll` callback.

In `schema.ts` add `'diagram.rename'` to the `commandKinds` enum so a saved record whose provenance names a rename survives reload.

- [ ] **Step 4: Run test, `npm run check`, browser-verify**

`npx vitest run src/presentation/components/inspection-shape.test.ts`; `npm run check`. Browser: click empty canvas (nothing selected) → the panel title is an editable field → type a new name → the canvas frame caption and the library overlay's entry both update; one undo reverts both; reload persists the name.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/components/inspect-panel.tsx src/presentation/components/inspector.tsx src/App.tsx src/domain/schema.ts src/presentation/components/inspection-shape.test.ts
git commit -m "feat(canvas): the diagram renames where its name already is"
```

---

### Task 5: A new diagram asks for its name

**Files:**
- Modify: `src/App.tsx` — `createDiagram` (~:205)
- Modify: `src/presentation/components/inspector.tsx` and `src/presentation/shell/panel-header.tsx` — optional auto-focus prop

**Interfaces:**
- Consumes: Task 4's rename path.
- Produces: `PanelHeaderProps.focusTitle?: boolean` — when set, the rename input focuses with its text selected, once.

- [ ] **Step 1: Auto-focus support in `PanelHeader`**

```tsx
/** Focuses the title field once, text selected — used the moment a thing is born nameless. */
focusTitle?: boolean;
```

On the rename input, add a ref effect:

```tsx
ref={(input) => { if (input && focusTitle) { input.focus(); input.select(); } }}
```

(One-shot is acceptable: the parent clears the flag after first render — see Step 3.)

- [ ] **Step 2: `createDiagram` asks for the name instead of deciding it**

In `App.tsx`, keep `'Untitled diagram'` as the stored name but add state and select nothing (so the Diagram inspection — not the root node's — shows):

```tsx
const [freshDiagramId, setFreshDiagramId] = useState<string | null>(null);
// inside createDiagram's .then, replacing setSelection({ kind: 'node', id: diagramId }):
setSelection(null);
setFreshDiagramId(diagramId);
```

- [ ] **Step 3: Thread and clear the flag**

Pass `focusTitle={open.record.id === freshDiagramId}` (match by the open diagram's id) through the inspector to `PanelHeader`; clear with `setFreshDiagramId(null)` when the rename first fires (wrap the diagram `rename` or hook the input's `onChange` once) and on diagram switch.

- [ ] **Step 4: `npm run check`, browser-verify**

`npm run check`. Browser: add a diagram → the panel shows the new diagram with its title field focused and "Untitled diagram" selected → typing replaces the name → Enter/blur commits → the library overlay lists the new name.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/presentation/components/inspector.tsx src/presentation/shell/panel-header.tsx
git commit -m "feat(canvas): a new diagram is born with its name ready to type over"
```

---

## Self-Review Notes (already applied)

- **Spec coverage:** bug 1 → Tasks 1-3; bug 3 → Tasks 1-2; bug 2 → Tasks 4-5. The rail-rename idea was explicitly dropped (the rail's diagram list no longer exists on `main`; the library overlay is a transient chooser and a bad host for rename).
- **Coordinate-space risk:** Task 3 commits from the overlay (values React Flow already reported in node coordinates) rather than `onResizeEnd` params, sidestepping absolute-vs-parent-relative ambiguity; the browser pass confirms with a child node inside a group.
- **Ghost risk (refused/cancelled commits):** overlay entries clear on dragStop/resizeEnd regardless of commit outcome (a refused commit correctly snaps back to record truth), on node removal, and on diagram switch. Escape-mid-drag is an explicit browser check in Task 2 Step 5.
- **Type consistency:** `applyFrame`/`mergeInFlight`/`clearInFlight`/`resizeEnd`/`focusTitle` names match across all tasks.
