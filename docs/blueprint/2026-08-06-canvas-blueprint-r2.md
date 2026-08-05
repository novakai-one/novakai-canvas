# Canvas Blueprint — Revision 2 (post-ratification) + Pass 2 contracts

> **Status:** Builder decisions — **not laws.** Revision 2 supersedes Revision 1 wherever they
> disagree. Revision 1 is kept unedited as the audit trail.
>
> **Builder:** Claude (Anthropic) · **Date:** 2026-08-06 · **Branch:** `claude/canvas-record-model`
> **Ratified against:** a fresh zero-context adversarial review that returned
> **"not safe to build against"** with 11 SEVERE and 12 MEDIUM findings. It was right about all
> of them; five were defects I did not have. Every one is resolved below at the source.

## Why this revision exists

The review's core charge: the gate failed on the one thing it exists to protect — an
irreversible migration over Chris's real, irreplaceable diagrams. It also proved one of the
four diagnoses Revision 1 rested on was stale, and that the delivery plan was horizontal
layers wearing vertical clothing.

## Findings → resolutions

| # | Sev | Finding | Resolution |
|---|---|---|---|
| 1 | SEVERE | Migration written for v2; the real committed data is v1 | **R-1.** Migration accepts v1 **and** v2 by chaining the existing tested v1→v2 step into v2→v3. Three real files now fixture-covered. |
| 2 | SEVERE | LBD-02's exception guards a case that never occurs; the real hazard — a cross-diagram wire — is silently destroyed | **R-2.** Cross-diagram relationships become a library-owned `CrossDiagramLink`. Nothing is dropped; the migration reports every one. |
| 3 | SEVERE | Three real comment nodes belong to no diagram and would vanish | **R-3.** Migration creates one visible **Unfiled** diagram and reports each move. Zero interpretation beats a clever guess. |
| 4 | SEVERE | 60 applied operations and `revision: 2440` have no migration rule; idempotency breaks across the boundary | **R-4.** Library owns a `migratedOperations` ledger consulted by every workspace. Each diagram starts at `globalRevision + 1`, so every pre-migration `expectedRevision` is stale → visible conflict, never a silent apply. |
| 5 | SEVERE | `node.setCollapsed` and `view.update` both write collapsed IDs — the document's own red gate 1 | **R-5.** Collapsed state lives in `View` alone. `node.setCollapsed` is deleted; `view.setCollapsed` replaces it. |
| 6 | SEVERE | "Undo is byte-identical" is unsatisfiable beside the idempotency ledger | **R-6.** Undo exactness is scoped to **content** (nodes, wires, interfaces, types, layouts, views). The operation ledger is monotonic and explicitly excluded. Invariant 9 restated: revision increases by exactly one per **committed state change**, change set or undo. |
| 7 | SEVERE | Durability boundary contradicts itself; applied-but-unsaved work is recoverable by neither undo nor storage | **R-7.** Stated plainly: `submit` = accepted **in memory**; `save` = **durable**. `persistedRevision()` exposes the gap. Save failure must surface — the current silent "their version wins" discard (`App.tsx:48`) and the exception-swallowing `load()` (`http-json-repository.ts:14`) are **defects scheduled for repair**, not craft-pass polish. |
| 8 | SEVERE | Single-file storage invalidates CAN-008 and P7 and deletes the only CLI↔browser lost-update protection | **R-8.** Reversed. **One file per diagram + a library index.** Per-record revision compare-and-swap crosses the S1 seam as a first-class concern with a typed `stale-revision` outcome. |
| 9 | SEVERE | Interfaces are regenerated method signatures keyed on label text — using them as ports breaks R7 on every `./canvas apply` and joins by name | **R-9. LBD-05 rejected.** Endpoints carry a stable `anchor` (side + ordinal), never a name-derived join. Attaching a wire to a specific interface is deferred until interface IDs are minted stably — a separate, named fix to `compile.ts`. |
| 10 | SEVERE | One-way migration forces the whole v3 schema into V1, so the slices are horizontal | **R-10.** The complete v3 record schema is settled **now** (Pass 2 below). One migration writes the final format; later slices add **behaviour**, never format. |
| 11 | SEVERE | V8 is a dumping ground; R1 and R7 are interaction requirements with no owner; there are zero error or empty states | **R-11.** Interaction and failure presentation get their own named slice with enumerated behaviours. R1/R7 are no longer discharged "through the public contract only". |
| 12 | MEDIUM | LBD-04's diagnosis is false at HEAD — Present is already an alias for the same focus path | **R-12.** Corrected. The change prevents regression; it does not repair a live bug. Same remedy, honest reason. |
| 13 | MEDIUM | `Type` and `sourceRefs` are durable with no writer | **R-13.** `type.add/update/remove` and `diagram.setReferences` restored to the contract. |
| 14 | MEDIUM | `expandsToDiagramId` dangles across records with no integrity owner | **R-14.** The library owns cross-record integrity: archive/delete return the inbound links that would dangle, and refuse by default. |
| 15 | MEDIUM | No read model, so every host re-implements visibility policy | **R-15.** `projectView()` joins nodes with placements and applies collapse policy once, inside the capability. |
| 16 | MEDIUM | Guarantee 10 omits interfaces and types; `node.remove` already orphans them | **R-16.** Removing a node removes its owned interfaces and types. Live leak fixed. |
| 17 | MEDIUM | Slice-layout semantics under-specified: mixed parents, group resize vs G5, empty target | **R-17.** Mixed-parent targets are rejected with a typed error. Ancestor groups **may** resize to contain their children — an explicit, named exception to G5, because containment is not arrangement. Empty target is a typed failure. |
| 18 | MEDIUM | `open()` concurrency and event timing undefined | **R-18.** One workspace instance per diagram per library — `open()` returns the existing one. Events fire on **commit**, not save; persistence is observed separately. |
| 19 | MEDIUM | O-1 left open while V1 writes kinds irreversibly; the `tree` kind would be silently deleted | **R-19.** Kinds settled now: `group`, `module`, `object`, `runtime`, `resource`, `comment`, `tree`. `tree` is kept — it has a domain module, a renderer and DSL support even at zero instances. |
| 20 | MEDIUM | Fixtures miss Chris's largest live file (282 nodes, 19 scopes) | **R-20.** Captured as a third fixture. Exit conditions now assert per-file counts, not a hard-coded 17. |
| 21 | MEDIUM | §17 omits the work-session-reporting capability entirely | **R-21.** Acknowledged as present and explicitly out of scope, so no builder relocates or deletes it. |
| 22 | LOW | `move` promised with no move operation | **R-22.** Claim withdrawn; no folder concept exists. |
| 23 | LOW | `search` ordering/matching and `save` failure detail undefined | **R-23.** Search: case-insensitive substring over diagram name and node labels, ordered by name, ties by ID. `save` distinguishes `stale-revision` from `save-failed`. |

## Revised load-bearing decisions

Unchanged from R1: **LBD-01** (diagram is the record and revision boundary), **LBD-03**
(layouts belong to a diagram), **LBD-06** (branded IDs; names never join), **LBD-11** (change set
is the only mutation path), **LBD-12** (actor identity from the composition root).

**LBD-02 (revised)** — The diagram root scope node is dissolved; `group` is its own kind. The
R1 exception rule is **deleted** (zero wires touch a root in any real file). Replaced by R-2 and
R-3: cross-diagram wires become library links; unparented non-root nodes go to **Unfiled**.

**LBD-04 (revised)** — `View` is durable; Edit/Present has no domain representation. Collapsed
IDs live **only** in `View` (R-5). Honest rationale (R-12): Present no longer derives a second
arrangement — it was fixed in `ebfd308` — so this makes the contradiction *unrepresentable*
rather than repairing a live bug.

**LBD-05 (REJECTED)** — Interfaces are not ports. See R-9. Replaced by **LBD-05b**: an endpoint
is `{ nodeId, anchor? }` where `anchor` is a stable side and ordinal. No name-derived joins.

**LBD-07 (revised)** — Revision is per diagram. The library additionally owns the
`migratedOperations` ledger (R-4) and cross-record integrity (R-14). It still has no version
counter of its own; **per-record compare-and-swap** at the storage seam replaces the file-level
check the single-file design would have destroyed (R-8).

**LBD-08 (revised)** — Migration is one-way and runs at the storage seam, accepting **v1 and v2**
(R-1), writing the complete final v3 format (R-10), and returning a **migration report** naming
every reassignment, link conversion, and ledger carry-forward.

**LBD-09 (revised)** — Undo is a bounded in-memory per-diagram snapshot stack; exactness is
content-scoped (R-6).

**LBD-10 (unchanged)** — Layout strategies are pure and deterministic behind one seam, with
R-17's semantics made explicit.

## Pass 2 — the settled v3 contract

Complete because R-10 requires it: one migration writes this shape, and no later slice changes
it. Branded IDs; every durable object carries `id`, `kind` where polymorphic, and the record
carries `schemaVersion`.

```ts
// Identity — mutually non-assignable; nothing parses an ID.
export type DiagramId = string & { readonly __brand: 'DiagramId' };
export type NodeId = string & { readonly __brand: 'NodeId' };
export type WireId = string & { readonly __brand: 'WireId' };
export type InterfaceId = string & { readonly __brand: 'InterfaceId' };
export type TypeId = string & { readonly __brand: 'TypeId' };
export type LayoutId = string & { readonly __brand: 'LayoutId' };
export type ViewId = string & { readonly __brand: 'ViewId' };
export type LinkId = string & { readonly __brand: 'LinkId' };

export type NodeKind =
  | 'group' | 'module' | 'object' | 'runtime' | 'resource' | 'comment' | 'tree';

export type WireKind =
  | 'owns' | 'references' | 'assigns' | 'queries' | 'executes' | 'mentions' | 'missing';

export type PortSide = 'top' | 'right' | 'bottom' | 'left';

/** Stable attachment point. Ordinal, never a name — R-9. */
export interface PortAnchor { side: PortSide; ordinal: number }

export interface Endpoint { nodeId: NodeId; anchor?: PortAnchor }

export interface CanvasWire {
  id: WireId; kind: WireKind; label: string;
  source: Endpoint; target: Endpoint;
}

export interface CanvasNode {
  id: NodeId; kind: NodeKind; label: string; description?: string;
  parentId?: NodeId;                       // resolves to a 'group' node; acyclic
  interfaceIds: InterfaceId[]; typeIds: TypeId[];
  rows?: TreeRow[];                        // 'tree' kind only — kept per R-19
  subjectRef?: CanvasReference;
  expandsToDiagramId?: DiagramId;          // integrity owned by the library — R-14
}

export interface NodePlacement {
  nodeId: NodeId; position: Position; size: Size; pinned: boolean;
}

export interface WireRouteHint {
  wireId: WireId; preferredSourceSide?: PortSide; preferredTargetSide?: PortSide;
  waypoints: Position[];                   // never a renderer path string
}

export interface CanvasLayout {
  id: LayoutId; name: string; strategy: LayoutStrategyName;
  placements: Record<NodeId, NodePlacement>;
  wireRouteHints: Record<WireId, WireRouteHint>;
}

/** Collapsed state lives here and nowhere else — R-5. */
export interface CanvasView {
  id: ViewId; name: string; layoutId: LayoutId;
  viewport: { x: number; y: number; zoom: number };
  collapsedNodeIds: NodeId[];
  hiddenKinds: NodeKind[];
}

/** One independently stored, independently revisioned diagram — LBD-01. */
export interface DiagramRecord {
  schemaVersion: 3;
  id: DiagramId;
  name: string;                            // owns its own title — LBD-02
  status: 'active' | 'archived';
  revision: number;
  nodes: Record<NodeId, CanvasNode>;
  wires: Record<WireId, CanvasWire>;
  interfaces: Record<InterfaceId, InterfaceObject>;
  types: Record<TypeId, TypeObject>;
  layouts: Record<LayoutId, CanvasLayout>;
  views: Record<ViewId, CanvasView>;
  activeViewId: ViewId;
  subjectRef?: CanvasReference;
  sourceRefs: SourceReference[];
  appliedOperations: Record<string, AppliedCanvasOperation>;
}

/** A relationship whose ends live in different diagrams — R-2. Owned by the library. */
export interface CrossDiagramLink {
  id: LinkId; kind: WireKind; label: string;
  source: { diagramId: DiagramId; nodeId: NodeId };
  target: { diagramId: DiagramId; nodeId: NodeId };
}

/** The library index: searchable without opening a record — CAN-008, R-8. */
export interface LibraryIndex {
  schemaVersion: 3;
  entries: Record<DiagramId, {
    id: DiagramId; name: string; status: 'active' | 'archived';
    revision: number; nodeLabels: string[];
  }>;
  links: Record<LinkId, CrossDiagramLink>;
  /** Pre-migration idempotency, preserved so replays stay recognised — R-4. */
  migratedOperations: string[];
}

export interface MigrationReport {
  fromSchemaVersion: 1 | 2;
  diagramsCreated: number;
  unfiledNodeIds: NodeId[];                // R-3, each one named
  crossDiagramLinks: LinkId[];             // R-2, each one named
  carriedOperationIds: string[];           // R-4
  startingRevision: number;                // globalRevision + 1
}
```

Storage seam, with the compare-and-swap finding 8 proved is load-bearing:

```ts
export interface CanvasLibraryRepository {
  readIndex(): Promise<LibraryIndex>;
  writeIndex(index: LibraryIndex): Promise<void>;
  readDiagram(id: DiagramId): Promise<DiagramRecord>;
  /** Fails with stale-revision when expectedRevision no longer matches — R-8. */
  writeDiagram(record: DiagramRecord, expectedRevision: number): Promise<WriteOutcome>;
  deleteDiagram(id: DiagramId): Promise<void>;
}

export type WriteOutcome =
  | { status: 'written'; revision: number }
  | { status: 'stale-revision'; actualRevision: number }
  | { status: 'save-failed'; reason: string };
```

Contract additions required by the review: `type.add|update|remove`,
`diagram.setReferences` (R-13), `view.setCollapsed` replacing `node.setCollapsed` (R-5),
`projectView()` read model (R-15), and archive/delete returning inbound links (R-14).

## Revised delivery slices — genuinely vertical now

Format is settled once in W1; every later slice adds behaviour over the same records (R-10).

| Slice | Behaviour delivered | Exit condition |
|---|---|---|
| **W1 Migration + records** | All three real files migrate to v3 records; one diagram opens, mutates, saves independently | Census equal across the boundary for every fixture; migration report names every reassignment; per-record CAS proven by a concurrent-write test |
| **W2 Arrangement** | Layouts + views per diagram; collapse via `view.setCollapsed`; `projectView()` read model | No domain type names a mode; one writer for collapsed state |
| **W3 Slice layout** | Targeted, pinned, previewed, deterministic; mixed-parent rejected; ancestor resize allowed | Byte-equality outside target except named ancestor exception; repeat run identical |
| **W4 Wires + anchors** | Stable anchors, reconnect preserving identity, route hints | Reconnect keeps ID/kind/label; no path string stored |
| **W5 Library** | Create, search, archive, restore with referential integrity | Search without opening records; archive reports inbound links |
| **W6 Interaction + failure** *(new, R-11)* | Drag wire ends, drag-to-connect, multi-select, empty-canvas deselect, **and** the error/empty/conflict states that do not exist today; repairs the silent-discard and swallowed-load defects | Every failure path visible in a real browser; no silent catch remains |
| **W7 Agent authoring** | Discovery, atomic batches, conflicts, idempotency through CLI/DSL | Agent authors from `describe()` alone; replay is `duplicate` |
| **W8 Second host + gate** | Object-store host; quality gate | Zero core edits; analytics ≥86 Canvas / ≥65 repo |

## What I am NOT claiming

No implementation-quality points are claimed anywhere. Every quality row is `specified` or
`unproven` until its slice produces cited evidence. The reviewer's verdict on Revision 1 —
"not safe to build against" — stands as recorded history; this revision exists because that
verdict was correct.
