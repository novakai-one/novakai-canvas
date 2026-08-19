/** canvas — author architecture maps from a terse DSL. Run `./canvas help`. */

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type {
  CanvasLibrary, CrossDiagramLink, DiagramRecord, RecordCommand,
} from '../../src/canvas.ts';
import { allComponents, kindList } from '../../src/components/registry.ts';
import { parseDsl } from './dsl-parse.ts';
import { compile, type CrossDiagramWire } from './compile.ts';
import { listMaps, printLibrary, printRecord, type CrossDiagramContext } from './dsl-print.ts';
import { dataDirectoryOf, openLibrary, readAllRecords, type OpenedLibrary } from './library-io.ts';
import { applyCompiledDiagram, removalCommandsFor } from './record-apply.ts';
import { asId, layoutRecord } from './record-graph.ts';
import { renderRecordSvg } from './snapshot.ts';
import { slugify } from './slug.ts';

const DEFAULT_DATA_DIR = fileURLToPath(new URL('../../public/data', import.meta.url));

const componentHelp = [
  `  node kinds    ${allComponents()
    .filter((component) => component.layoutRole === 'leaf')
    .map((component) => component.dslKeyword)
    .join(' | ')}`,
  ...allComponents().flatMap((component) => component.helpLines ?? []).map((line) => `  ${line}`),
].join('\n');

const HELP = `canvas — draw architecture maps from your terminal

Usage
  ./canvas maps                     list maps (top-level scopes)
  ./canvas read [map]               print a map (or all maps) as DSL
  ./canvas describe                 print the machine-readable command vocabulary
  ./canvas batch <map> [json-file]  atomically apply one typed change set (file or stdin)
  ./canvas apply [dsl-file]         create/replace maps from DSL (file or stdin)
  ./canvas rm <map> [node|zone]   remove a node or zone (zones cascade), or a whole map
  ./canvas snapshot <map> [-o out]  render a map to SVG
  ./canvas help                     this text

  --file <path>   use another data directory (default: public/data)
  --operation-id <id>  stable retry identity for apply

DSL — one statement per line; a scope block fully declares that map.
Layout is automatic: never write coordinates, never edit the JSON by hand.

  scope "Agent Browser Sessions"
    note "One session per instance; renders off-screen."
    module "Session broker" "Owns leases and allocation"
      acquire(AgentId) -> SessionHandle
      release(SessionId) -> void
      type SessionHandle { sessionId, cdpEndpoint }
    runtime "Chrome instances"
    resource "sessions.json"
    wire "browse CLI" -> "Session broker" : acquire(AgentId) -> SessionHandle [queries]

${componentHelp}
  methods       name(TypeA, TypeB) -> TypeC            under a node; bare type names
  types         type Name { fieldA, fieldB }           under a node
  wires         wire A -> B : <the actual call> [kind]
                kind: owns|references|assigns|queries|executes|mentions|missing
                an endpoint naming a node in another map becomes a cross-map link
  names         quote multi-word names: "browse CLI"; single tokens can go bare
`;

/** Every mutation `./canvas batch` accepts, mirroring the capability's command vocabulary. */
const COMMAND_KINDS = [
  'node.add', 'node.move', 'node.resize', 'node.pin', 'node.update', 'node.reparent',
  'node.remove', 'wire.add', 'wire.reconnect', 'wire.remove', 'view.setCollapsed',
  'view.setViewport', 'diagram.rename',
] as const;

interface Args { verb: string; positional: string[]; dataDir: string; out?: string; operationId?: string }

function parseArgs(argv: string[]): Args {
  const args: Args = { verb: argv[0] ?? 'help', positional: [], dataDir: DEFAULT_DATA_DIR };
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--file' || argv[index] === '--data') args.dataDir = dataDirectoryOf(argv[(index += 1)]);
    else if (argv[index] === '-o' || argv[index] === '--out') args.out = argv[(index += 1)];
    else if (argv[index] === '--operation-id') args.operationId = argv[(index += 1)];
    else args.positional.push(argv[index]);
  }
  return args;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** Resolves a map argument to a diagram id, by id first and then by the diagram's own name. */
function diagramIdOrFail(library: CanvasLibrary, query: string): string {
  const summaries = library.list({ includeArchived: true });
  const querySlug = slugify(query);
  const match = summaries.find((summary) => summary.id === query)
    ?? summaries.find((summary) => slugify(summary.name) === querySlug)
    ?? summaries.find((summary) => slugify(summary.id) === querySlug);
  if (!match) fail(`no map "${query}" — available: ${summaries.map((summary) => summary.id).join(', ')}`);
  return match.id as string;
}

function crossDiagramContext(records: Record<string, DiagramRecord>, links: CrossDiagramLink[]): CrossDiagramContext {
  return {
    links,
    labelOf: (diagramId, nodeId) => records[diagramId]?.nodes[nodeId]?.label,
  };
}

function readStdinOr(path: string | undefined, hint: string): string {
  if (path) return readFileSync(path, 'utf8');
  if (process.stdin.isTTY) fail(hint);
  return readFileSync(0, 'utf8');
}

/**
 * Gives a cross-diagram relationship a stable identity across re-applies.
 *
 * Re-declaring the same wire must update the link the library already holds, not add a second
 * one beside it — including the one the migration created, whose id came from the legacy wire.
 * So an existing link between the same two nodes wins over a freshly derived id.
 */
function linkIdFor(existing: CrossDiagramLink[], wire: CrossDiagramWire): string {
  const already = existing.find((link) =>
    link.source.nodeId === wire.source.nodeId && link.target.nodeId === wire.target.nodeId);
  return (already?.id as string | undefined) ?? `${wire.source.nodeId}--to--${wire.target.nodeId}`;
}

/**
 * Records the cross-diagram relationships one apply declared, and drops the ones it withdrew.
 *
 * A link naming a node that the re-applied diagram no longer contains points at nothing, so it
 * is removed rather than left to dangle — the same rule the record model applies to a wire whose
 * endpoint disappears.
 */
async function reconcileLinks(
  library: CanvasLibrary,
  records: Record<string, DiagramRecord>,
  appliedDiagramIds: Set<string>,
  declared: CrossDiagramWire[],
): Promise<string[]> {
  const notes: string[] = [];
  const before = Object.values(library.index().links);
  const keep = new Set<string>();

  for (const wire of declared) {
    const id = linkIdFor(before, wire);
    keep.add(id);
    const outcome = await library.addLink({
      id: asId(id),
      kind: wire.kind,
      label: wire.label,
      source: { diagramId: asId(wire.source.diagramId), nodeId: asId(wire.source.nodeId) },
      target: { diagramId: asId(wire.target.diagramId), nodeId: asId(wire.target.nodeId) },
    });
    if ('status' in outcome) notes.push(`cross-map link ${id} not stored: ${outcome.status}`);
    else notes.push(`cross-map link: ${wire.source.nodeId} -> ${wire.target.diagramId}/${wire.target.nodeId}`);
  }

  for (const link of before) {
    if (keep.has(link.id as string)) continue;
    const ends = [link.source, link.target];
    const dangling = ends.some((end) => appliedDiagramIds.has(end.diagramId as string)
      && !records[end.diagramId]?.nodes[end.nodeId]);
    if (!dangling) continue;
    await library.removeLink(link.id as string);
    notes.push(`dropped cross-map link ${link.id}: its endpoint no longer exists`);
  }
  return notes;
}

async function runMaps(opened: OpenedLibrary): Promise<void> {
  const records = await readAllRecords(opened.repository, opened.library);
  const maps = listMaps(
    opened.library.list({ includeArchived: true }).map((summary) => records[summary.id]),
    Object.values(opened.library.index().links),
  );
  const width = Math.max(...maps.map((map) => map.id.length), 2);
  for (const map of maps) {
    process.stdout.write(`${map.id.padEnd(width)}  ${String(map.nodes).padStart(3)} nodes  ${String(map.wires).padStart(3)} wires  ${map.label}\n`);
  }
}

async function runRead(opened: OpenedLibrary, query: string | undefined): Promise<void> {
  const records = await readAllRecords(opened.repository, opened.library);
  const context = crossDiagramContext(records, Object.values(opened.library.index().links));
  if (!query) {
    const ordered = opened.library.list({ includeArchived: true }).map((summary) => records[summary.id]);
    process.stdout.write(printLibrary(ordered, context));
    return;
  }
  process.stdout.write(printRecord(records[diagramIdOrFail(opened.library, query)], context));
}

async function runApply(opened: OpenedLibrary, args: Args): Promise<void> {
  const source = readStdinOr(args.positional[0], 'apply needs DSL: pass a file, or pipe it in. See ./canvas help');
  const { scopes, errors: parseErrors } = parseDsl(source);
  if (scopes.length === 0 && parseErrors.length === 0) fail('no scopes found in the DSL. See ./canvas help');

  const records = await readAllRecords(opened.repository, opened.library);
  const compiled = compile(scopes, records, Object.values(opened.library.index().links));
  const allErrors = [
    ...parseErrors.map((error) => `line ${error.line}: ${error.message}\n  fix: ${error.hint}`),
    ...compiled.errors.map((error) => `${error.message}\n  fix: ${error.hint}`),
  ];
  if (allErrors.length > 0) fail(`${allErrors.length} error(s), nothing written:\n${allErrors.join('\n')}`);
  for (const warning of compiled.warnings) process.stderr.write(`warning: ${warning}\n`);

  const operationId = args.operationId ?? `cli-apply-${randomUUID()}`;
  const timestamp = new Date().toISOString();
  const lines: string[] = [];
  const applied = new Set<string>();

  for (const diagram of compiled.diagrams) {
    const outcome = await applyCompiledDiagram(
      { library: opened.library, repository: opened.repository, operationId, timestamp },
      diagram,
    );
    if (!('status' in outcome)) fail(`apply failed for ${outcome.diagramId}: ${outcome.reason}`);
    applied.add(outcome.diagramId);
    lines.push(`${outcome.status}: ${outcome.name} (revision ${outcome.revision})`);
  }

  const after = await readAllRecords(opened.repository, opened.library);
  const notes = await reconcileLinks(
    opened.library, after, applied, compiled.diagrams.flatMap((diagram) => diagram.crossDiagramWires),
  );
  for (const note of notes) process.stderr.write(`note: ${note}\n`);
  // Entries are a projection over the records, and apply writes records directly so their
  // methods and types travel with them; rebuilding is how the projection catches up.
  await opened.library.rebuildIndex();
  process.stdout.write(`${lines.join('\n')}\n`);
}

async function runRemove(opened: OpenedLibrary, args: Args): Promise<void> {
  const diagramId = diagramIdOrFail(opened.library, args.positional[0]);

  if (!args.positional[1]) {
    const outcome = await opened.library.remove(diagramId);
    if (outcome !== true) {
      if (outcome.status === 'inbound-links-exist') {
        fail(`refusing to remove "${diagramId}": other maps link to it (${outcome.links.join(', ')})`);
      }
      fail(`could not remove "${diagramId}": ${outcome.status}`);
    }
    process.stdout.write(`removed: ${diagramId}\n`);
    return;
  }

  const workspace = await opened.library.open(diagramId);
  if (!('snapshot' in workspace)) fail(`could not open "${diagramId}": ${workspace.status}`);
  const record = workspace.snapshot();
  const nameSlug = slugify(args.positional[1]);
  const target = Object.values(record.nodes).find((node) => slugify(node.label) === nameSlug);
  if (!target) fail(`no node "${args.positional[1]}" in ${diagramId}`);

  const outcome = workspace.submit({
    operationId: args.operationId ?? `cli-rm-${randomUUID()}`,
    expectedRevision: record.revision,
    timestamp: new Date().toISOString(),
    commands: removalCommandsFor(record, target.id as string),
  });
  if (outcome.status !== 'applied') fail(`rm ${outcome.status}: ${JSON.stringify(outcome)}`);

  const written = await opened.repository.writeDiagram(layoutRecord(workspace.snapshot()), record.revision);
  if (written.status !== 'written') fail(`rm save ${written.status}`);
  await opened.library.rebuildIndex();
  process.stdout.write(`removed: ${target.label} (revision ${written.revision})\n`);
}

async function runBatch(opened: OpenedLibrary, args: Args): Promise<void> {
  if (args.positional.length === 0) fail('batch needs a map: ./canvas batch <map> [json-file]');
  const diagramId = diagramIdOrFail(opened.library, args.positional[0]);
  const source = readStdinOr(
    args.positional[1], 'batch needs JSON: pass a file, or pipe it in. See ./canvas describe',
  );
  const parsed = JSON.parse(source) as {
    operationId?: unknown; expectedRevision?: unknown; timestamp?: unknown; commands?: unknown;
  };
  if (typeof parsed.operationId !== 'string' || !Array.isArray(parsed.commands)) {
    fail('a change set needs an operationId and a commands array. See ./canvas describe');
  }
  const commands = parsed.commands as RecordCommand[];
  for (const command of commands) {
    if (!COMMAND_KINDS.includes(command?.kind as (typeof COMMAND_KINDS)[number])) {
      fail(`unknown command kind "${String(command?.kind)}". See ./canvas describe`);
    }
  }

  const workspace = await opened.library.open(diagramId);
  if (!('snapshot' in workspace)) fail(`could not open "${diagramId}": ${workspace.status}`);
  const before = workspace.snapshot();
  const outcome = workspace.submit({
    operationId: parsed.operationId,
    expectedRevision: typeof parsed.expectedRevision === 'number' ? parsed.expectedRevision : before.revision,
    timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
    commands,
  });
  if (outcome.status === 'applied') {
    const written = await opened.library.save(diagramId);
    if (written.status !== 'written') fail(`batch save ${written.status}`);
  }
  process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
  if (outcome.status === 'conflict' || outcome.status === 'rejected') process.exitCode = 2;
}

/** The vocabulary an unfamiliar agent needs to drive `./canvas batch` without reading code. */
function describeCapability(): unknown {
  return {
    schemaVersion: 3,
    unit: 'diagram-record',
    commandKinds: [...COMMAND_KINDS],
    nodeKinds: [...kindList()],
    // The DSL says `scope` for the root group; `zone` (the component's keyword) is the nested form.
    nodeAliases: { group: 'scope' },
    wireKinds: ['owns', 'references', 'assigns', 'queries', 'executes', 'mentions', 'missing'],
    changeSet: {
      operationId: 'string — stable retry identity; a repeat returns "duplicate"',
      expectedRevision: 'number — the revision the batch was composed against',
      timestamp: 'string — ISO 8601',
      commands: 'RecordCommand[] — applied in order, all or nothing',
    },
    outcomes: ['applied', 'duplicate', 'conflict', 'rejected'],
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.verb === 'help' || args.verb === '--help' || args.verb === '-h') {
    process.stdout.write(HELP);
    return;
  }
  if (args.verb === 'describe') {
    process.stdout.write(`${JSON.stringify(describeCapability(), null, 2)}\n`);
    return;
  }
  if (!['maps', 'read', 'apply', 'rm', 'snapshot', 'batch'].includes(args.verb)) {
    process.stdout.write(HELP);
    fail(`unknown verb "${args.verb}"`);
  }

  const opened = await openLibrary(args.dataDir, args.positional[0] ?? 'stdin');

  if (args.verb === 'maps') return runMaps(opened);
  if (args.verb === 'read') return runRead(opened, args.positional[0]);
  if (args.verb === 'apply') return runApply(opened, args);
  if (args.verb === 'batch') return runBatch(opened, args);
  if (args.verb === 'rm') {
    if (args.positional.length === 0) fail('rm needs a map (and optionally a node): ./canvas rm <map> [node]');
    return runRemove(opened, args);
  }

  if (args.positional.length === 0) fail('snapshot needs a map: ./canvas snapshot <map> [-o out.svg]');
  const diagramId = diagramIdOrFail(opened.library, args.positional[0]);
  const record = await opened.repository.readDiagram(diagramId);
  const out = args.out ?? `${diagramId}.svg`;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(out, renderRecordSvg(record), 'utf8');
  process.stdout.write(`${out}\n`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
