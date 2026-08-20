/** Compiles parsed scope ASTs into diagram-record content, one record per scope block. */

import type { CrossDiagramLink, DiagramRecord } from '../../src/canvas.ts';
import type { NodeAst, ScopeAst, ZoneAst } from './dsl-parse.ts';
import type { RecordNode, RecordWire, RecordWireKind } from './record-graph.ts';
import { asId, descendantIds, rootGroupId } from './record-graph.ts';
import { slugify } from './slug.ts';
import { componentFor } from '../../src/components/registry.ts';
import type {
  ContainerArrangement, NodeAppearance, ParsedPresentation,
} from '../../src/domain/canvas-presentation.ts';

/** Tree row shape, derived from the record node rather than named — `TreeRow` isn't on the public path. */
type TreeRow = NonNullable<RecordNode['rows']>[number];

/** A refusal to compile, always paired with the fix that would make it compile. */
export interface CompileError { message: string; hint: string }

/** One end of a relationship, named by the diagram that owns the node and the node itself. */
export interface LinkEnd { diagramId: string; nodeId: string }

/** A relationship the DSL declared whose far end lives in a different diagram. */
export interface CrossDiagramWire {
  kind: RecordWireKind;
  label: string;
  source: LinkEnd;
  target: LinkEnd;
}

/** One diagram's complete content, exactly as its scope block declares it. */
export interface CompiledDiagram {
  /** Reuses the existing record's id when the scope already exists, so identity survives. */
  id: string;
  name: string;
  rootNodeId: string;
  nodes: Record<string, RecordNode>;
  wires: Record<string, RecordWire>;
  interfaces: DiagramRecord['interfaces'];
  types: DiagramRecord['types'];
  appearanceByNodeId: Record<string, NodeAppearance>;
  arrangementByContainerId: Record<string, ContainerArrangement>;
  /** Wires the record cannot hold, because a wire belongs to exactly one diagram. */
  crossDiagramWires: CrossDiagramWire[];
}

/** Everything one `./canvas apply` compiled, including what it refused and what it warned about. */
export interface CompileResult {
  diagrams: CompiledDiagram[];
  errors: CompileError[];
  warnings: string[];
  /** Diagram ids that did not exist before this compile. */
  createdDiagramIds: string[];
}

function closestCandidates(labels: Map<string, string>, query: string): string[] {
  const querySlug = slugify(query);
  return [...labels.entries()]
    .map(([slug, label]) => {
      let score = 0;
      if (slug.includes(querySlug) || querySlug.includes(slug)) score = 2;
      else {
        let shared = 0;
        while (shared < Math.min(slug.length, querySlug.length) && slug[shared] === querySlug[shared]) shared += 1;
        score = shared / Math.max(slug.length, 1);
      }
      return { label, score };
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 5)
    .map((entry) => entry.label);
}

/** Finds the record a scope block refers to: by diagram id first, then by diagram name. */
function existingRecordFor(
  existing: Record<string, DiagramRecord>,
  label: string,
): DiagramRecord | undefined {
  const wanted = slugify(label);
  return existing[wanted]
    ?? Object.values(existing).find((record) => slugify(record.name) === wanted);
}

/** Every node in every OTHER diagram, indexed by label slug, for cross-diagram wire endpoints. */
function foreignNodesByLabel(
  existing: Record<string, DiagramRecord>,
  selfIds: Set<string>,
): { ends: Map<string, LinkEnd[]>; labels: Map<string, string> } {
  const ends = new Map<string, LinkEnd[]>();
  const labels = new Map<string, string>();
  for (const record of Object.values(existing)) {
    if (selfIds.has(record.id as string)) continue;
    for (const node of Object.values(record.nodes)) {
      if (componentFor(node.kind).identity?.wireEndpoint === false) continue;
      const slug = slugify(node.label);
      labels.set(slug, node.label);
      ends.set(slug, [...(ends.get(slug) ?? []), {
        diagramId: record.id as string, nodeId: node.id as string,
      }]);
    }
  }
  return { ends, labels };
}

/**
 * Compiles scope blocks into per-record content.
 *
 * Each scope block fully declares its diagram, so a record's contents are rebuilt from the DSL
 * rather than merged into. Identity is what survives: a node whose label still slugifies the
 * same keeps the id it already had, which is what lets a re-apply preserve placements, wires
 * pointing in from elsewhere, and anything a host has pinned to a node id.
 */
export function compile(
  scopes: ScopeAst[],
  existing: Record<string, DiagramRecord>,
  links: CrossDiagramLink[] = [],
): CompileResult {
  const errors: CompileError[] = [];
  const warnings: string[] = [];
  const diagrams: CompiledDiagram[] = [];
  const createdDiagramIds: string[] = [];

  // Every diagram this apply declares, so a wire between two scopes in the SAME apply resolves
  // against the content being written rather than against whatever is still on disk.
  const declared = new Map<string, { scopeAst: ScopeAst; record?: DiagramRecord; id: string; rootNodeId: string }>();
  for (const scopeAst of scopes) {
    const record = existingRecordFor(existing, scopeAst.label);
    const slug = slugify(scopeAst.label);
    const id = (record?.id as string | undefined) ?? slug;
    const rootNodeId = (record && rootGroupId(record)) ?? slug;
    declared.set(id, { scopeAst, record, id, rootNodeId });
    if (!record) createdDiagramIds.push(id);
  }

  const declaredIds = new Set(declared.keys());
  const foreign = foreignNodesByLabel(existing, declaredIds);

  for (const { scopeAst, record, id: diagramId, rootNodeId } of declared.values()) {
    const nodes: Record<string, RecordNode> = {};
    const wires: Record<string, RecordWire> = {};
    const interfaces: DiagramRecord['interfaces'] = {};
    const types: DiagramRecord['types'] = {};
    const crossDiagramWires: CrossDiagramWire[] = [];
    const appearanceByNodeId: Record<string, NodeAppearance> = {};
    const arrangementByContainerId: Record<string, ContainerArrangement> = {};

    // Ids of the nodes this scope had before, by label slug, so re-applied nodes keep them.
    const oldIdBySlug = new Map<string, string>();
    const oldIdByParentIdentity = new Map<string, string>();
    if (record) {
      for (const nodeId of descendantIds(record, rootNodeId)) {
        const oldNode = record.nodes[nodeId];
        const identity = componentFor(oldNode.kind).identity;
        if (identity?.scope === 'parent' && oldNode.parentId) {
          oldIdByParentIdentity.set(
            `${identity.namespace}\u0000${oldNode.parentId}\u0000${slugify(oldNode.label)}`,
            nodeId,
          );
        } else {
          oldIdBySlug.set(slugify(oldNode.label), nodeId);
        }
      }
    }

    nodes[rootNodeId] = {
      id: asId(rootNodeId),
      kind: 'group',
      label: scopeAst.label,
      ...(scopeAst.description ? { description: scopeAst.description } : {}),
      interfaceIds: [],
      typeIds: [],
    };

    // Labels are unique per map so wires can resolve endpoints by label alone (ruling R7).
    const idByLabelSlug = new Map<string, string>();
    const mapLabelSlugs = new Map<string, string>();
    const parentIdentityKeys = new Set<string>();
    let commentCount = 0;

    const compileNodes = (nodeAsts: NodeAst[], parentId: string): string[] => {
      const compiledIds: string[] = [];
      for (const nodeAst of nodeAsts) {
        const component = componentFor(nodeAst.kind);
        const identity = component.identity;
        const isComment = nodeAst.kind === 'comment';
        const labelSlug = isComment
          ? `note-${(commentCount += 1)}-${slugify(nodeAst.label).slice(0, 24)}`
          : slugify(nodeAst.label);
        const parentIdentityKey = identity?.scope === 'parent'
          ? `${identity.namespace}\u0000${parentId}\u0000${slugify(nodeAst.label)}` : undefined;
        if (parentIdentityKey && parentIdentityKeys.has(parentIdentityKey)) {
          errors.push({
            message: `duplicate sibling ${component.dslKeyword} label "${nodeAst.label}" in map "${scopeAst.label}"`,
            hint: `${component.dslKeyword} labels must be unique within one parent`,
          });
          continue;
        }
        if (!identity && !isComment && mapLabelSlugs.has(labelSlug)) {
          errors.push({
            message: `duplicate label "${nodeAst.label}" in map "${scopeAst.label}"`,
            hint: 'labels must be unique within a map — wires resolve endpoints by label',
          });
          continue;
        }
        if (parentIdentityKey) parentIdentityKeys.add(parentIdentityKey);
        if (!identity && !isComment) mapLabelSlugs.set(labelSlug, nodeAst.label);
        const nodeId = parentIdentityKey
          ? oldIdByParentIdentity.get(parentIdentityKey)
            ?? `${parentId}--${identity!.namespace}-${slugify(nodeAst.label)}`
          : oldIdBySlug.get(labelSlug) ?? `${parentId}--${labelSlug}`;
        if (identity?.wireEndpoint !== false) idByLabelSlug.set(labelSlug, nodeId);

        const interfaceIds: string[] = [];
        for (const interfaceAst of nodeAst.interfaces) {
          // Interface ids are minted from the slugified method name and so are regenerated on
          // every apply. Renaming a method therefore mints a new id; nothing durable may key on
          // one (which is why wire endpoints anchor to an ordinal, not to an interface).
          let interfaceId = `${nodeId}--if-${slugify(interfaceAst.name)}`;
          while (interfaces[interfaceId]) interfaceId += '-x';
          interfaces[interfaceId] = {
            id: interfaceId,
            ownerId: nodeId,
            name: interfaceAst.name,
            accepts: interfaceAst.accepts,
            returns: interfaceAst.returns,
          };
          interfaceIds.push(interfaceId);
        }
        const typeIds: string[] = [];
        for (const typeAst of nodeAst.types) {
          let typeId = `${nodeId}--type-${slugify(typeAst.name)}`;
          while (types[typeId]) typeId += '-x';
          types[typeId] = { id: typeId, name: typeAst.name, fields: typeAst.fields };
          typeIds.push(typeId);
        }

        const rows = (nodeAst.children.rows ?? []) as TreeRow[];
        const rowIds = new Set(rows.map((row) => row.id));
        for (const row of rows) {
          if (row.parentRowId && !rowIds.has(row.parentRowId)) {
            warnings.push(`row "${row.id}" names missing parent "${row.parentRowId}" — rendered top-level`);
          }
        }
        const childContent = Object.fromEntries(
          Object.entries(nodeAst.children).filter(([, content]) => content.length > 0),
        );
        nodes[nodeId] = {
          id: asId(nodeId),
          kind: nodeAst.kind,
          label: nodeAst.label,
          ...(nodeAst.description ? { description: nodeAst.description } : {}),
          parentId: asId(parentId),
          interfaceIds: interfaceIds.map((each) => asId(each)),
          typeIds: typeIds.map((each) => asId(each)),
          ...nodeAst.content,
          ...childContent,
        };
        if (nodeAst.presentation?.appearance
          && Object.keys(nodeAst.presentation.appearance).length > 0) {
          appearanceByNodeId[nodeId] = nodeAst.presentation.appearance;
        }
        compiledIds.push(nodeId);
      }
      return compiledIds;
    };

    const storeArrangement = (
      containerId: string,
      presentation: ParsedPresentation | undefined,
      childIds: string[],
    ): void => {
      if (!presentation?.arrangement) return;
      arrangementByContainerId[containerId] = {
        layout: presentation.arrangement.layout,
        childIds,
        gap: presentation.arrangement.gap,
        align: presentation.arrangement.align,
        ...(presentation.arrangement.columns === undefined
          ? {} : { columns: presentation.arrangement.columns }),
      };
    };

    function compileDeclarations(
      declarations: (NodeAst | ZoneAst)[],
      parentId: string,
    ): string[] {
      return declarations.flatMap((declaration) => 'kind' in declaration
        ? compileNodes([declaration], parentId)
        : compileZones([declaration], parentId));
    }

    function compileZones(zoneAsts: ZoneAst[], parentId: string): string[] {
      const compiledIds: string[] = [];
      for (const zoneAst of zoneAsts) {
        const labelSlug = slugify(zoneAst.label);
        if (mapLabelSlugs.has(labelSlug)) {
          errors.push({
            message: `duplicate label "${zoneAst.label}" in map "${scopeAst.label}"`,
            hint: 'labels must be unique within a map — wires resolve endpoints by label',
          });
          continue;
        }
        mapLabelSlugs.set(labelSlug, zoneAst.label);
        const zoneId = oldIdBySlug.get(labelSlug) ?? `${parentId}--${labelSlug}`;
        idByLabelSlug.set(labelSlug, zoneId);
        nodes[zoneId] = {
          id: asId(zoneId),
          kind: 'group',
          label: zoneAst.label,
          ...(zoneAst.description ? { description: zoneAst.description } : {}),
          parentId: asId(parentId),
          interfaceIds: [],
          typeIds: [],
        };
        const childIds = compileDeclarations(zoneAst.declarations, zoneId);
        storeArrangement(zoneId, zoneAst.presentation, childIds);
        compiledIds.push(zoneId);
      }
      return compiledIds;
    }

    const rootChildIds = compileDeclarations(scopeAst.declarations, rootNodeId);
    storeArrangement(rootNodeId, scopeAst.presentation, rootChildIds);

    // Endpoints resolve inside this diagram first. Only a name this diagram does not hold is
    // looked for elsewhere, so a label reused in two maps always means the local one.
    const resolveLocal = (name: string): string | undefined => idByLabelSlug.get(slugify(name));

    // A label can name a node in more than one other map. A link the library already holds
    // between this wire's near end and one of the candidates settles it — otherwise re-applying
    // a map would silently re-point a real relationship at a same-named node somewhere else.
    const resolveForeign = (name: string, nearNodeId: string | undefined): LinkEnd | undefined => {
      const candidates = foreign.ends.get(slugify(name));
      if (!candidates || candidates.length === 0) return undefined;
      if (candidates.length === 1) return candidates[0];
      const alreadyLinked = candidates.find((candidate) => links.some((link) =>
        (link.source.nodeId === nearNodeId && link.target.nodeId === candidate.nodeId)
        || (link.target.nodeId === nearNodeId && link.source.nodeId === candidate.nodeId)));
      if (alreadyLinked) return alreadyLinked;
      const sorted = [...candidates].sort((a, b) => a.diagramId.localeCompare(b.diagramId));
      warnings.push(
        `"${name}" names a node in ${candidates.length} other maps — linked to ${sorted[0].diagramId}`,
      );
      return sorted[0];
    };
    const allLabels = new Map([...foreign.labels.entries(), ...mapLabelSlugs.entries()]);

    let wireCount = 0;
    for (const wireAst of scopeAst.wires) {
      const localSource = resolveLocal(wireAst.source);
      const localTarget = resolveLocal(wireAst.target);
      const resolveEnd = (name: string, local: string | undefined, nearNodeId: string | undefined) => {
        if (local) return { local, end: { diagramId, nodeId: local } };
        const far = resolveForeign(name, nearNodeId);
        if (far) return { local: undefined, end: far };
        errors.push({
          message: `wire endpoint "${name}" (line ${wireAst.line}) does not match any node`,
          hint: `closest labels: ${closestCandidates(allLabels, name).join(', ')}`,
        });
        return undefined;
      };
      const source = resolveEnd(wireAst.source, localSource, localTarget);
      const target = resolveEnd(wireAst.target, localTarget, localSource);
      if (!source || !target) continue;

      if (!source.local || !target.local) {
        // A wire belongs to exactly one diagram, so a relationship crossing two has no home in
        // either record. The library owns it as a CrossDiagramLink instead of it being dropped.
        crossDiagramWires.push({
          kind: wireAst.kind, label: wireAst.contract, source: source.end, target: target.end,
        });
        continue;
      }
      wireCount += 1;
      const wireId = `${rootNodeId}--wire-${wireCount}`;
      wires[wireId] = {
        id: asId(wireId),
        kind: wireAst.kind,
        label: wireAst.contract,
        source: { nodeId: asId(source.local) },
        target: { nodeId: asId(target.local) },
      };
    }

    diagrams.push({
      id: diagramId,
      name: scopeAst.label,
      rootNodeId,
      nodes,
      wires,
      interfaces,
      types,
      appearanceByNodeId,
      arrangementByContainerId,
      crossDiagramWires,
    });
  }

  return { diagrams, errors, warnings, createdDiagramIds };
}
