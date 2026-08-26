scope "Canvas target attempt" orientation=left-right
  note "Attempt to reproduce the hand-drawn reading target using only app features. Gaps noted in the diagnosis."

  zone "Authoring · tools/canvas-cli"
    module "canvas CLI" "The only supported write path"
      apply(DslText) -> WriteOutcome
      snapshot(MapId) -> Svg
    module "DSL parser" "dsl-parse/*: tokens to ScopeAst"
      parse(DslText) -> ScopeAst
    module "Compiler" "compile/*: ScopeAst to DiagramRecord"
      compile(ScopeAst) -> CompileResult
  end

  zone "Storage · public/data"
    resource "diagrams/<slug>.json" "One DiagramRecord per map"
    resource "library.json" "Index plus cross-map links"
  end

  zone "Runtime · src"
    module "Canvas library" "application/canvas-library"
      load(MapId) -> DiagramRecord
      save(DiagramRecord) -> WriteOutcome
    module "Geometry engine" "domain/diagram-geometry"
      layoutScopes(Record) -> Placements
      planWireRoutes(Topology) -> WireRoute[]
    module "Projection" "presentation/projection"
      projectNodes(Input) -> Node[]
      projectWires(Input) -> Edge[]
    module "React Flow host" "presentation/nodes + edges"
  end

  ooux-object "Map" ref=map palette=violet
    attribute "name" id=map-name type=string role=core
    attribute "status" id=map-status type=enum role=core traits=filterable
    attribute "revision" id=map-revision type=number role=metadata traits=sortable
    cta "applyDSL" id=cta-apply role=agent
    cta "snapshot" id=cta-snapshot role=human
    cta "archive" id=cta-archive role=owner

  zone "Record model · src/domain/records.ts" layout=grid columns=4 gap=16
    entity "DIAGRAM_RECORD" ref=diagram-record palette=blue
      field "id" id=diagram-id type=DiagramId keys=pk
      field "name" id=diagram-name type=string
      field "schemaVersion" id=schema-version type="3" keys=uk
      field "revision" id=revision type=int
    entity "CANVAS_NODE" ref=canvas-node palette=blue
      field "id" id=node-id type=NodeId keys=pk
      field "kind" id=node-kind type=NodeKind
      field "parentId" id=node-parent type=NodeId keys=fk
      field "expandsTo" id=node-expands type=DiagramId keys=fk
    entity "CANVAS_WIRE" ref=canvas-wire palette=blue
      field "id" id=wire-id type=WireId keys=pk
      field "kind" id=wire-kind type=WireKind
      field "source" id=wire-source type=Endpoint keys=fk
      field "target" id=wire-target type=Endpoint keys=fk
    entity "ENDPOINT" ref=endpoint palette=blue
      field "nodeId" id=ep-node type=NodeId keys=fk
      field "anchor" id=ep-anchor type=PortAnchor
      field "cardinality" id=ep-card type=Cardinality
    entity "FLOW" ref=flow palette=blue
      field "id" id=flow-id type=FlowId keys=pk
      field "name" id=flow-name type=string
    entity "FLOW_STEP" ref=flow-step palette=blue
      field "ref" id=step-ref type=WireId keys=pk,fk
      field "ordinal" id=step-ordinal type=int keys=pk
    entity "INTERFACE" ref=interface palette=blue
      field "id" id=interface-id type=InterfaceId keys=pk
      field "ownerId" id=interface-owner type=NodeId keys=fk
      field "accepts" id=interface-accepts type=Type[]
      field "returns" id=interface-returns type=Type[]
    entity "TYPE_OBJECT" ref=type-object palette=blue
      field "id" id=type-id type=TypeId keys=pk
      field "name" id=type-name type=string
      field "fields" id=type-fields type=string[]
    entity "CANVAS_LAYOUT" ref=canvas-layout palette=sage
      field "id" id=layout-id type=LayoutId keys=pk
      field "strategy" id=layout-strategy type=enum
    entity "NODE_PLACEMENT" ref=node-placement palette=sage
      field "nodeId" id=placement-node type=NodeId keys=pk,fk
      field "position" id=placement-position type=Point
      field "pinned" id=placement-pinned type=bool
    entity "WIRE_ROUTE_HINT" ref=wire-route-hint palette=sage
      field "wireId" id=hint-wire type=WireId keys=pk,fk
      field "waypoints" id=hint-waypoints type=Point[]
    entity "CANVAS_VIEW" ref=canvas-view palette=sage
      field "id" id=view-id type=ViewId keys=pk
      field "layoutId" id=view-layout type=LayoutId keys=fk
      field "flowId" id=view-flow type=FlowId keys=fk
    entity "LIBRARY_INDEX" ref=library-index palette=violet
      field "revision" id=index-revision type=int
      field "links" id=index-links type=Link[]
    entity "CROSS_DIAGRAM_LINK" ref=cross-link palette=violet
      field "id" id=link-id type=LinkId keys=pk
      field "source" id=link-source type=NodeRef keys=fk
      field "target" id=link-target type=NodeRef keys=fk
  end

  block "Legend"
    line "owns solid · references green · queries blue"
    line "executes violet · mentions amber · missing dotted"
    line "crow's foot: || one · o| zero-or-one · |{ one-or-many · o{ zero-or-many"
    line "gold: active flow"

  tree "Containment"
    row map project label "Map (DiagramRecord)"
    row zone mission parent=map label "zone (group node)"
    row node task parent=zone label "module / entity / ..."
    row leaf bucket parent=node label "method · field · row"

  wire "canvas CLI" -> "DSL parser" : parse(DslText) -> ScopeAst [executes]
  wire "DSL parser" -> "Compiler" : compile(ScopeAst) -> CompileResult [executes]
  wire "Compiler" -> "diagrams/<slug>.json" : write(DiagramRecord) -> void [owns]
  wire "diagrams/<slug>.json" -> "Canvas library" : load(MapId) -> DiagramRecord [queries]
  wire "library.json" -> "Canvas library" : readIndex() -> LibraryIndex [queries]
  wire "Canvas library" -> "Geometry engine" : plan(Record) -> LayoutPlan [executes]
  wire "Geometry engine" -> "Projection" : projectView(Record, View) -> ProjectedView [executes]
  wire "Projection" -> "React Flow host" : render(Nodes, Edges) -> Pixels [executes]

  wire "Map" -> "DIAGRAM_RECORD" width=thin color=amber pattern=dashed : backedBy(Map) -> DiagramRecord [mentions]

  wire "DIAGRAM_RECORD" -> "CANVAS_NODE" source-cardinality=one target-cardinality=zero-or-many width=medium : contains [owns]
  wire "DIAGRAM_RECORD" -> "CANVAS_WIRE" source-cardinality=one target-cardinality=zero-or-many width=medium : contains [owns]
  wire "DIAGRAM_RECORD" -> "FLOW" source-cardinality=one target-cardinality=zero-or-many width=medium : declares [owns]
  wire "DIAGRAM_RECORD" -> "CANVAS_LAYOUT" source-cardinality=one target-cardinality=one-or-many width=medium : arranges [owns]
  wire "DIAGRAM_RECORD" -> "CANVAS_VIEW" source-cardinality=one target-cardinality=one-or-many width=medium : reads [owns]
  wire "CANVAS_WIRE" -> "CANVAS_NODE" source-cardinality=zero-or-many target-cardinality=one width=medium color=green : source [references]
  wire "CANVAS_WIRE" -> "CANVAS_NODE" source-cardinality=zero-or-many target-cardinality=one width=medium color=green : target [references]
  wire "CANVAS_WIRE" -> "ENDPOINT" source-cardinality=one target-cardinality=zero-or-many width=medium : anchors [owns]
  wire "CANVAS_NODE" -> "CANVAS_NODE" source-cardinality=zero-or-many target-cardinality=zero-or-one width=medium : parent [owns]
  wire "CANVAS_NODE" -> "INTERFACE" source-cardinality=one target-cardinality=zero-or-many width=medium : exposes [owns]
  wire "CANVAS_NODE" -> "DIAGRAM_RECORD" source-cardinality=zero-or-many target-cardinality=zero-or-one width=medium color=green : expandsTo [references]
  wire "FLOW" -> "FLOW_STEP" source-cardinality=one target-cardinality=one-or-many width=medium : orders [owns]
  wire "FLOW_STEP" -> "CANVAS_WIRE" source-cardinality=zero-or-many target-cardinality=one width=medium color=green : references [references]
  wire "INTERFACE" -> "TYPE_OBJECT" source-cardinality=zero-or-many target-cardinality=zero-or-many width=medium color=green : acceptsReturns [references]
  wire "CANVAS_LAYOUT" -> "NODE_PLACEMENT" source-cardinality=one target-cardinality=zero-or-many width=medium : places [owns]
  wire "CANVAS_LAYOUT" -> "WIRE_ROUTE_HINT" source-cardinality=one target-cardinality=zero-or-many width=medium : routes [owns]
  wire "NODE_PLACEMENT" -> "CANVAS_NODE" source-cardinality=one target-cardinality=one width=medium color=green : geometryFor [references]
  wire "WIRE_ROUTE_HINT" -> "CANVAS_WIRE" source-cardinality=zero-or-many target-cardinality=one width=medium color=green : hints [references]
  wire "CANVAS_VIEW" -> "CANVAS_LAYOUT" source-cardinality=zero-or-many target-cardinality=one width=medium color=green : uses [references]
  wire "CANVAS_VIEW" -> "FLOW" source-cardinality=zero-or-many target-cardinality=zero-or-one width=medium color=green : emphasises [references]
  wire "LIBRARY_INDEX" -> "DIAGRAM_RECORD" source-cardinality=one target-cardinality=zero-or-many width=medium color=green : indexes [references]
  wire "LIBRARY_INDEX" -> "CROSS_DIAGRAM_LINK" source-cardinality=one target-cardinality=zero-or-many width=medium : owns [owns]
  wire "CROSS_DIAGRAM_LINK" -> "CANVAS_NODE" source-cardinality=zero-or-many target-cardinality=one width=medium color=green : joinsAcrossMaps [references]

  flow "From DSL line to pixels"
    step 1 "canvas-target-attempt--wire-1"
    step 2 "canvas-target-attempt--wire-2"
    step 3 "canvas-target-attempt--wire-3"
    step 4 "canvas-target-attempt--wire-4"
    step 5 "canvas-target-attempt--wire-6"
    step 6 "canvas-target-attempt--wire-7"
    step 7 "canvas-target-attempt--wire-8"
  end
