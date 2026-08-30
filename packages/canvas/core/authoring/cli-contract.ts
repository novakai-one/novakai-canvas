/** Human and machine-readable Canvas CLI vocabulary. */

import { allComponents, kindList } from '../components/registry.ts';
import { DIAGRAM_EXPORT_FORMATS } from '../export/contract.ts';
import {
  CONTAINER_ALIGNS, GRID_COLUMNS, SPACINGS, appearanceSpecification,
} from '../../contract/schemas/presentation.ts';
import { WIRE_APPEARANCE_SPECIFICATIONS } from '../../contract/schemas/wire-appearance.ts';
import { WIRE_CARDINALITIES } from '../../contract/schemas/wire-cardinality.ts';
import { RECORD_COMMAND_KINDS } from '../../contract/workspace-commands.ts';
import { wireAttributeHelp } from './wires/wire-attributes.ts';

const wireAppearanceHelp = wireAttributeHelp();

const componentHelp = [
  `  node kinds    ${allComponents().filter((component) => component.layoutRole === 'leaf')
    .map((component) => component.dslKeyword).join(' | ')}`,
  ...allComponents().flatMap((component) => [
    `  ${component.kind.padEnd(12)} ${component.declaration.syntax}`,
    ...(component.dslChildren ?? []).map((child) => `  ${child.contentKey.padEnd(12)} ${child.syntax}`),
    ...(component.appearanceKeys ?? []).map((key) => {
      const specification = appearanceSpecification(key);
      const omission = specification.omitted === undefined
        ? 'component default' : `default ${specification.omitted}`;
      return `  ${(component.dslKeyword + '.' + key).padEnd(12)} ${specification.values.join('|')} (${omission})`;
    }),
    ...((component.arrangementModes?.length ?? 0) > 0 ? [
      `  ${(component.dslKeyword + '.layout').padEnd(12)} ${component.arrangementModes?.join('|')}`,
      ...(component.arrangementModes?.includes('grid') ? [
        `  ${(component.dslKeyword + '.columns').padEnd(12)} ${GRID_COLUMNS.join('|')} (required for grid)`,
      ] : []),
      `  ${(component.dslKeyword + '.gap').padEnd(12)} ${SPACINGS.join('|')} (default 16)`,
      `  ${(component.dslKeyword + '.align').padEnd(12)} ${CONTAINER_ALIGNS.join('|')} (default stretch)`,
    ] : []),
  ]),
].join('\n');

export const CLI_HELP = `canvas — draw architecture maps from your terminal

Usage
  ./canvas maps                     list maps (top-level scopes)
  ./canvas flows <map>              list named flows and their ordered wire IDs
  ./canvas read [map] [--format dsl|agent|markdown|json]
                                    export one map (or all maps); default dsl
  ./canvas describe                 print the machine-readable command vocabulary
  ./canvas batch <map> [json-file]  atomically apply one typed change set (file or stdin)
  ./canvas apply [dsl-file]         create/replace maps from DSL (file or stdin)
  ./canvas check [dsl-file]         validate and lay out DSL without writing (file or stdin)
  ./canvas rm <map> [node|zone]   remove a node or zone (zones cascade), or a whole map
  ./canvas snapshot <map> [-o out]  render a map to SVG
  ./canvas help                     this text

  --file <path>   use another data directory (default: public/data)
  --operation-id <id>  stable retry identity for apply
  --format <format>     read output: ${DIAGRAM_EXPORT_FORMATS.join('|')} (default dsl)

DSL — one statement per line; a scope block fully declares that map.
New objects are placed automatically; saved placement is preserved. Never write coordinates or edit JSON by hand.
Scope and zone containers share the zone.layout, zone.gap and zone.align vocabulary.

  scope "Agent Browser Sessions" [orientation=top-down|left-right]  # which way the map runs
    note "One session per instance; renders off-screen."
    module "Session broker" "Owns leases and allocation" [band=0|1|2|…] [lane=0|1|2|…]
      acquire(AgentId) -> SessionHandle
      release(SessionId) -> void
      type SessionHandle { sessionId, cdpEndpoint }
    runtime "Chrome instances"
    resource "sessions.json"
    zone "Protected store" [crossing=gated|free] [gate="node label"] ... end
    wire "browse CLI" -> "Session broker.acquire" : acquire(AgentId) -> SessionHandle [queries]
    flow "Acquire a session"
      step 1 "agent-browser-sessions--wire-1" "acquire()"
    end

${componentHelp}
  methods       name(TypeA, TypeB) -> TypeC            under a node; bare type names
  types         type Name { fieldA, fieldB }           under a node
  wires         wire A|A.method|@ref|#node-id -> B|B.method|@ref|#node-id ${wireAppearanceHelp} : <contract> [kind]
                kind: owns|references|assigns|queries|executes|mentions|missing
                A.method names one method declared directly under node A
                an endpoint naming a node in another map becomes a cross-map link
  flows         flow "Name" [id=stable-id] ... step 1 "existing-wire-id" ["label"] ... end
                a step's optional label shows on its badge while the flow is active; steps may reuse one wire
  names         quote multi-word names: "browse CLI"; single tokens can go bare
`;

export const COMMAND_KINDS = RECORD_COMMAND_KINDS;

/** The vocabulary an unfamiliar agent needs to drive Canvas without reading code. */
export function describeCapability(): unknown {
  return {
    schemaVersion: 3,
    unit: 'diagram-record',
    commandKinds: [...COMMAND_KINDS],
    nodeKinds: [...kindList()],
    nodeAliases: { group: 'scope' },
    wireKinds: ['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing'],
    wireCardinalities: [...WIRE_CARDINALITIES],
    changeSet: {
      operationId: 'string — stable retry identity; a repeat returns "duplicate"',
      expectedRevision: 'number — the revision the batch was composed against',
      timestamp: 'string — ISO 8601',
      commands: 'RecordCommand[] — applied in order, all or nothing',
    },
    outcomes: ['applied', 'duplicate', 'conflict', 'rejected'],
    exports: {
      formats: [...DIAGRAM_EXPORT_FORMATS],
      default: 'dsl',
      command: './canvas read [map] --format <format>',
    },
    dsl: {
      flow: {
        syntax: 'flow <name> [id=<stable-id>] ... step <positive ordinal> <wire-id> ["<label>"] ... end',
        stepLabel: 'optional; shows on the step badge and panel while the flow is active, falling back to the wire label; steps may reuse one wire',
        ownership: 'diagram semantic data; creates no node, wire, layout, or view',
        activationCommand: 'flow.activate',
      },
      wire: {
        syntax: `wire <label|node.method|@ref|#node-id> -> <label|node.method|@ref|#node-id> ${wireAppearanceHelp} : <contract> [kind]`,
        endpoints: ['label', 'node.method', '@ref', '#node-id'],
        cardinality: {
          source: { key: 'source-cardinality', values: [...WIRE_CARDINALITIES], omitted: 'arrow' },
          target: { key: 'target-cardinality', values: [...WIRE_CARDINALITIES], omitted: 'arrow' },
        },
        appearance: WIRE_APPEARANCE_SPECIFICATIONS.map((entry) => ({
          key: entry.key, values: [...entry.values], omitted: entry.omitted,
        })),
      },
      components: allComponents().map((component) => ({
        kind: component.kind,
        keyword: component.dslKeyword,
        declaration: { syntax: component.declaration.syntax, example: component.declaration.example },
        children: (component.dslChildren ?? []).map((child) => ({
          keyword: child.keyword, syntax: child.syntax, example: child.example,
        })),
        appearance: (component.appearanceKeys ?? []).map((key) => {
          const specification = appearanceSpecification(key);
          return {
            key, values: [...specification.values],
            ...(specification.omitted === undefined
              ? { omitted: 'component default' } : { default: specification.omitted }),
          };
        }),
        ...(component.arrangementModes ? {
          arrangement: {
            layout: { values: [...component.arrangementModes] },
            ...(component.arrangementModes.includes('grid') ? {
              columns: { values: [...GRID_COLUMNS], requiredFor: 'grid' },
            } : {}),
            gap: { values: [...SPACINGS], default: 16 },
            align: { values: [...CONTAINER_ALIGNS], default: 'stretch' },
          },
        } : {}),
      })),
    },
  };
}
