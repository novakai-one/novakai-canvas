scope "Novakai Canvas diagram engine" orientation=left-right
  note "Self-diagnosis: how this app models and draws entities, cardinality, modules, OOUX and flows — authored through ./canvas apply, the very pipeline it depicts."

  zone "Authoring · tools/canvas-cli"
    module "canvas CLI" "The only supported write path"
      apply(DslText) -> WriteOutcome
      snapshot(MapId) -> Svg
    module "DSL parser" "dsl-parse/*: tokens to statements to ScopeAst"
      parse(DslText) -> ScopeAst
      type ScopeAst { label, orientation, statements }
    module "Compiler" "compile/*: ScopeAst to DiagramRecord; wires resolve against local nodes and foreign maps"
      compile(ScopeAst, ExistingRecords) -> CompileResult
  end

  zone "Storage · public/data"
    resource "diagrams/<slug>.json" "One DiagramRecord per file, schemaVersion 3"
    resource "library.json" "LibraryIndex: entries, cross-map links, migrated operations"
  end

  zone "Runtime · src"
    module "Canvas library" "application/canvas-library: loads and saves records, owns link integrity"
      load(MapId) -> DiagramRecord
      save(DiagramRecord) -> WriteOutcome
    module "Geometry engine" "domain/diagram-geometry + domain/layout: automatic placement and wire routing; semantic nodes never hold coordinates"
      layoutScopes(DiagramRecord) -> Placements
      planWireRoutes(Topology) -> WireRouteList
    module "Projection" "presentation/projection: record plus view becomes React Flow nodes and edges"
      projectNodes(ProjectionInput) -> FlowNodes
      projectWires(ProjectionInput) -> FlowEdges
    module "React Flow host" "presentation/nodes + edges: one renderer per registered kind; crow's-foot glyphs via wire-end-decorations"
  end

  ooux-object "Map" ref=map palette=violet
    attribute "name" id=map-name type=string role=core
    attribute "status" id=map-status type=enum role=core traits=filterable
    attribute "orientation" id=map-orientation type=enum role=metadata
    attribute "revision" id=map-revision type=number role=metadata traits=sortable
    cta "applyDSL" id=cta-apply role=agent
    cta "snapshot" id=cta-snapshot role=human
    cta "archive" id=cta-archive role=owner

  zone "Record model · src/domain/records.ts" layout=grid columns=3 gap=16
    entity "DIAGRAM_RECORD" ref=diagram-record palette=blue
      field "id" id=diagram-id type=DiagramId keys=pk
      field "name" id=diagram-name type=string
      field "schemaVersion" id=schema-version type="3" keys=uk
      field "orientation" id=orientation type=Orientation
      field "revision" id=revision type=number
    entity "CANVAS_NODE" ref=canvas-node palette=blue
      field "id" id=node-id type=NodeId keys=pk
      field "kind" id=node-kind type=NodeKind
      field "parentId" id=node-parent type=NodeId keys=fk
      field "interfaceIds" id=node-interfaces type=InterfaceId[] keys=fk
      field "expandsToDiagramId" id=node-expands type=DiagramId keys=fk
    entity "CANVAS_WIRE" ref=canvas-wire palette=blue
      field "id" id=wire-id type=WireId keys=pk
      field "kind" id=wire-kind type=WireKind
      field "source" id=wire-source type=Endpoint keys=fk
      field "target" id=wire-target type=Endpoint keys=fk
      field "cardinality" id=wire-cardinality type=Cardinality
    entity "FLOW" ref=flow palette=blue
      field "id" id=flow-id type=FlowId keys=pk
      field "name" id=flow-name type=string
    entity "FLOW_STEP" ref=flow-step palette=blue
      field "ref" id=step-ref type=WireId keys=pk,fk
      field "ordinal" id=step-ordinal type=number keys=pk
    entity "INTERFACE" ref=interface palette=blue
      field "id" id=interface-id type=InterfaceId keys=pk
      field "ownerId" id=interface-owner type=NodeId keys=fk
      field "accepts" id=interface-accepts type=TypeName[]
      field "returns" id=interface-returns type=TypeName[]
    entity "TYPE_OBJECT" ref=type-object palette=blue
      field "id" id=type-id type=TypeId keys=pk
      field "name" id=type-name type=string
      field "fields" id=type-fields type=string[]
    entity "CANVAS_LAYOUT" ref=canvas-layout palette=sage
      field "id" id=layout-id type=LayoutId keys=pk
      field "strategy" id=layout-strategy type=LayoutStrategy
    entity "NODE_PLACEMENT" ref=node-placement palette=sage
      field "nodeId" id=placement-node type=NodeId keys=pk,fk
      field "position" id=placement-position type=Point
      field "pinned" id=placement-pinned type=boolean
    entity "CANVAS_VIEW" ref=canvas-view palette=sage
      field "id" id=view-id type=ViewId keys=pk
      field "layoutId" id=view-layout type=LayoutId keys=fk
      field "flowId" id=view-flow type=FlowId keys=fk
    entity "LIBRARY_INDEX" ref=library-index palette=violet
      field "revision" id=index-revision type=number
      field "entries" id=index-entries type=Entry[]
      field "links" id=index-links type=CrossLink[]
  end

  wire "canvas CLI" -> "DSL parser" : parse(DslText) -> ScopeAst [executes]
  wire "DSL parser" -> "Compiler" : compile(ScopeAst) -> CompileResult [executes]
  wire "Compiler" -> "diagrams/<slug>.json" : write(DiagramRecord) -> void [owns]
  wire "diagrams/<slug>.json" -> "Canvas library" : load(MapId) -> DiagramRecord [queries]
  wire "library.json" -> "Canvas library" : readIndex() -> LibraryIndex [queries]
  wire "Canvas library" -> "Geometry engine" : plan(DiagramRecord) -> LayoutPlan [executes]
  wire "Geometry engine" -> "Projection" : projectView(Record, View) -> ProjectedView [executes]
  wire "Projection" -> "React Flow host" : render(FlowNodes, FlowEdges) -> Pixels [executes]

  wire "Map" -> "DIAGRAM_RECORD" : oouxViewOf(DiagramRecord) -> Map [references]

  wire "DIAGRAM_RECORD" -> "CANVAS_NODE" source-cardinality=one target-cardinality=zero-or-many : contains [owns]
  wire "DIAGRAM_RECORD" -> "CANVAS_WIRE" source-cardinality=one target-cardinality=zero-or-many : contains [owns]
  wire "DIAGRAM_RECORD" -> "FLOW" source-cardinality=one target-cardinality=zero-or-many : declares [owns]
  wire "FLOW" -> "FLOW_STEP" source-cardinality=one target-cardinality=one-or-many : orders [owns]
  wire "FLOW_STEP" -> "CANVAS_WIRE" source-cardinality=zero-or-many target-cardinality=one : references [references]
  wire "CANVAS_WIRE" -> "CANVAS_NODE" source-cardinality=zero-or-many target-cardinality=one : source [references]
  wire "CANVAS_WIRE" -> "CANVAS_NODE" source-cardinality=zero-or-many target-cardinality=one : target [references]
  wire "CANVAS_NODE" -> "CANVAS_NODE" source-cardinality=zero-or-many target-cardinality=zero-or-one : parentId [owns]
  wire "CANVAS_NODE" -> "INTERFACE" source-cardinality=one target-cardinality=zero-or-many : exposes [owns]
  wire "INTERFACE" -> "TYPE_OBJECT" source-cardinality=zero-or-many target-cardinality=zero-or-many : acceptsReturns [references]
  wire "DIAGRAM_RECORD" -> "CANVAS_LAYOUT" source-cardinality=one target-cardinality=one-or-many : arranges [owns]
  wire "CANVAS_LAYOUT" -> "NODE_PLACEMENT" source-cardinality=one target-cardinality=zero-or-many : places [owns]
  wire "NODE_PLACEMENT" -> "CANVAS_NODE" source-cardinality=one target-cardinality=one : geometryFor [references]
  wire "DIAGRAM_RECORD" -> "CANVAS_VIEW" source-cardinality=one target-cardinality=one-or-many : reads [owns]
  wire "CANVAS_VIEW" -> "CANVAS_LAYOUT" source-cardinality=zero-or-many target-cardinality=one : uses [references]
  wire "CANVAS_VIEW" -> "FLOW" source-cardinality=zero-or-many target-cardinality=zero-or-one : emphasises [references]
  wire "LIBRARY_INDEX" -> "DIAGRAM_RECORD" source-cardinality=one target-cardinality=zero-or-many : indexes [references]
  wire "CANVAS_NODE" -> "DIAGRAM_RECORD" source-cardinality=zero-or-many target-cardinality=zero-or-one : expandsTo [references]

  flow "From DSL line to pixels"
    step 1 "novakai-canvas-diagram-engine--wire-1"
    step 2 "novakai-canvas-diagram-engine--wire-2"
    step 3 "novakai-canvas-diagram-engine--wire-3"
    step 4 "novakai-canvas-diagram-engine--wire-4"
    step 5 "novakai-canvas-diagram-engine--wire-6"
    step 6 "novakai-canvas-diagram-engine--wire-7"
    step 7 "novakai-canvas-diagram-engine--wire-8"
  end
