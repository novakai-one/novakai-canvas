scope "Canvas — target architecture" orientation=left-right
  note "Target state under the 16 principles: one owner per fact, hosts import the contract only."

  object "Agent" "Authors maps as DSL text from the terminal"
  object "Human" "Reads and edits maps on the canvas"

  zone "packages/canvas" "The capability. No React, no filesystem, no host imports."
    zone "contract" "The only door in — everything a consumer may know"
      module "schemas" "Parses unknown JSON at the seam; nothing unvalidated passes"
        parseRecord(unknown) -> DiagramRecord
      module "commands" "Typed commands — the only way to change a record"
        type MoveNode { nodeId, position }
        type SetArrangement { containerId, mode }
    end
    zone "core/domain" "Pure rules. One module per fact."
      module "records" "Owns DiagramRecord invariants and command application"
        applyCommand(DiagramRecord, Command) -> DiagramRecord
      module "layout" "THE placement engine — the repo's only dagre import. Containers bottom-up, dagre ranks siblings, explicit row/grid skips dagre."
        planLayout(Graph, Target) -> Placements
      module "appearance" "Kind decides colour. One resolver for every host."
        resolveAppearance(Node, Theme) -> Appearance
      module "flows" "Active flow decides which wires light up"
        activeSteps(Flow) -> StepMap
    end
    zone "core/application" "Use cases — a command in, a consistent record out"
      module "workspace" "Runs one command, then reflows only what it disturbed"
        execute(Command) -> DiagramRecord
    end
    zone "core/authoring" "The agent write path — text in, record out"
      module "dsl-parse" "DSL text to AST; every syntax error named here"
        parse(DslText) -> ScopeAst
      module "compile" "AST to record changes; never invents geometry"
        compile(ScopeAst) -> DiagramRecord
    end
    zone "core/rendering" "Second host — proves the contract without React"
      module "snapshot" "Record to SVG through the same domain rules"
        renderSvg(DiagramRecord) -> Svg
    end
    zone "adapters" "The only code that touches disk"
      module "json-store" "Loads and saves records atomically"
        load(MapId) -> DiagramRecord
        save(DiagramRecord) -> Revision
    end
    zone "cli"
      module "canvas CLI" "apply · read · snapshot · rm"
        apply(DslText) -> WriteOutcome
    end
  end

  zone "src — React host" "Presentation only. Imports the contract, never core."
    module "projection" "Record to React Flow nodes and edges — the one translator"
      projectView(DiagramRecord, View) -> ProjectedView
    runtime "React Flow"
    ooux-object "Canvas surface" ref=canvas-surface
      attribute "activeMap" id=surface-map type=MapId role=core
      attribute "selection" id=surface-selection type=NodeId[] role=core
      attribute "camera" id=surface-camera type=Viewport role=metadata
      cta "drag node" id=surface-drag role=human
      cta "connect wire" id=surface-connect role=human
      cta "travel to map" id=surface-travel role=human
    ooux-object "Left rail" ref=left-rail
      attribute "maps" id=rail-maps type=MapSummary[] role=core traits=filterable
      attribute "viewPresets" id=rail-presets type=Preset[] role=core
      cta "open map" id=rail-open role=human
    ooux-object "Inspector" ref=inspector
      attribute "target" id=inspector-target type=NodeId role=core
      attribute "arrangement" id=inspector-arrangement type=enum role=core
      attribute "theme" id=inspector-theme type=ThemePreset role=metadata
      cta "set arrangement" id=inspector-arrange role=human
      cta "run flow" id=inspector-flow role=human
  end

  zone "public/data" "On disk. Written by the adapter, never by hand."
    resource "diagrams/*.json" "One DiagramRecord per map"
    resource "library.json" "Index and cross-map links"
  end

  zone "record model" "What the store holds" layout=grid columns=4 gap=16
    entity "LIBRARY_INDEX" ref=library-index
      field "revision" id=li-revision type=int
      field "links" id=li-links type=Link[]
    entity "DIAGRAM_RECORD" ref=diagram-record
      field "id" id=dr-id type=DiagramId keys=pk
      field "name" id=dr-name type=string
      field "revision" id=dr-revision type=int
    entity "CANVAS_NODE" ref=canvas-node
      field "id" id=cn-id type=NodeId keys=pk
      field "kind" id=cn-kind type=NodeKind
      field "parentId" id=cn-parent type=NodeId keys=fk
    entity "CANVAS_WIRE" ref=canvas-wire
      field "id" id=cw-id type=WireId keys=pk
      field "source" id=cw-source type=NodeId keys=fk
      field "target" id=cw-target type=NodeId keys=fk
      field "cardinality" id=cw-cardinality type=Cardinality
    entity "FLOW" ref=flow
      field "id" id=fl-id type=FlowId keys=pk
      field "name" id=fl-name type=string
    entity "FLOW_STEP" ref=flow-step
      field "ordinal" id=fs-ordinal type=int keys=pk
      field "wireId" id=fs-wire type=WireId keys=fk
    entity "CANVAS_LAYOUT" ref=canvas-layout
      field "id" id=cl-id type=LayoutId keys=pk
      field "arrangementByContainer" id=cl-arrangement type=map
    entity "NODE_PLACEMENT" ref=node-placement
      field "nodeId" id=np-node type=NodeId keys=pk,fk
      field "position" id=np-position type=Point
      field "pinned" id=np-pinned type=bool
  end

  wire "Agent" -> "canvas CLI.apply" : apply(DslText) -> WriteOutcome [executes]
  wire "canvas CLI" -> "dsl-parse.parse" : parse(DslText) -> ScopeAst [executes]
  wire "dsl-parse" -> "compile.compile" : compile(ScopeAst) -> DiagramRecord [executes]
  wire "compile" -> "layout.planLayout" : place new nodes only [executes]
  wire "canvas CLI" -> "json-store.save" : save(DiagramRecord) -> Revision [executes]
  wire "json-store" -> "diagrams/*.json" source-cardinality=one target-cardinality=zero-or-many : writes records [owns]
  wire "json-store" -> "library.json" source-cardinality=one target-cardinality=one : writes index [owns]
  wire "Human" -> "Left rail" : open map [executes]
  wire "Left rail" -> "library.json" : listMaps() -> MapSummary[] [queries]
  wire "Left rail" -> "json-store.load" : load(MapId) -> DiagramRecord [queries]
  wire "json-store" -> "schemas.parseRecord" : parseRecord(unknown) -> DiagramRecord [executes]
  wire "schemas" -> "projection" : guarded DiagramRecord [queries]
  wire "projection" -> "appearance.resolveAppearance" : resolveAppearance(Node, Theme) -> Appearance [queries]
  wire "projection" -> "flows.activeSteps" : activeSteps(Flow) -> StepMap [queries]
  wire "projection" -> "React Flow" : projectView(Record, View) -> ProjectedView [executes]
  wire "React Flow" -> "Canvas surface" : paints nodes, wires, badges [executes]
  wire "canvas CLI" -> "snapshot.renderSvg" : renderSvg(DiagramRecord) -> Svg [executes]
  wire "snapshot" -> "appearance" : same resolver, second host [queries]
  wire "Human" -> "Canvas surface" : drag · select · connect [executes]
  wire "Human" -> "Inspector" : set arrangement · run flow [executes]
  wire "Canvas surface" -> "workspace.execute" : execute(MoveNode) -> DiagramRecord [executes]
  wire "Inspector" -> "workspace.execute" : execute(SetArrangement) -> DiagramRecord [executes]
  wire "workspace" -> "records.applyCommand" : applyCommand(Record, Command) -> Record [executes]
  wire "workspace" -> "layout.planLayout" : reflow only disturbed nodes [executes]
  wire "workspace" -> "json-store.save" : save(DiagramRecord) -> Revision [executes]
  wire "records" -> @diagram-record width=thin pattern=dashed : owns the invariants [owns]
  wire @library-index -> @diagram-record source-cardinality=one target-cardinality=zero-or-many : lists [references]
  wire @diagram-record -> @canvas-node source-cardinality=one target-cardinality=zero-or-many : contains [owns]
  wire @diagram-record -> @canvas-wire source-cardinality=one target-cardinality=zero-or-many : contains [owns]
  wire @diagram-record -> @flow source-cardinality=one target-cardinality=zero-or-many : declares [owns]
  wire @diagram-record -> @canvas-layout source-cardinality=one target-cardinality=one-or-many : arranges [owns]
  wire @canvas-wire -> @canvas-node source-cardinality=zero-or-many target-cardinality=one : source [references]
  wire @canvas-wire -> @canvas-node source-cardinality=zero-or-many target-cardinality=one : target [references]
  wire @canvas-node -> @canvas-node source-cardinality=zero-or-many target-cardinality=zero-or-one : parent zone [references]
  wire @flow -> @flow-step source-cardinality=one target-cardinality=one-or-many : orders [owns]
  wire @flow-step -> @canvas-wire source-cardinality=zero-or-many target-cardinality=one : lights up [references]
  wire @canvas-layout -> @node-placement source-cardinality=one target-cardinality=zero-or-many : places [owns]
  wire @node-placement -> @canvas-node source-cardinality=one target-cardinality=one : geometryFor [references]

  flow "Agent authors via DSL"
    step 1 "canvas-target-architecture--wire-1" "apply()"
    step 2 "canvas-target-architecture--wire-2" "parse()"
    step 3 "canvas-target-architecture--wire-3" "compile()"
    step 4 "canvas-target-architecture--wire-4" "planLayout()"
    step 5 "canvas-target-architecture--wire-5" "save()"
    step 6 "canvas-target-architecture--wire-6" "write"
    step 7 "canvas-target-architecture--wire-7" "index"
  end
  flow "Human edit reflows layout"
    step 1 "canvas-target-architecture--wire-19" "drag"
    step 2 "canvas-target-architecture--wire-21" "execute(MoveNode)"
    step 3 "canvas-target-architecture--wire-23" "applyCommand()"
    step 4 "canvas-target-architecture--wire-24" "reflow disturbed"
    step 5 "canvas-target-architecture--wire-25" "save()"
  end
  flow "Open a map, run a flow"
    step 1 "canvas-target-architecture--wire-8" "open"
    step 2 "canvas-target-architecture--wire-10" "load()"
    step 3 "canvas-target-architecture--wire-11" "parseRecord()"
    step 4 "canvas-target-architecture--wire-14" "activeSteps()"
    step 5 "canvas-target-architecture--wire-15" "project()"
    step 6 "canvas-target-architecture--wire-16" "paint"
  end
