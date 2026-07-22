/** canvas — author architecture maps from a terse DSL. Run `./canvas help`. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ArchitectureDocument } from '../../src/domain/model';
import { parseDsl } from './dsl-parse.ts';
import { compile } from './compile.ts';
import { layoutScopes, overlappingScopes } from './layout.ts';
import { listMaps, printOutline, printScope } from './dsl-print.ts';
import { loadDocument, saveDocument } from './document-io.ts';
import { renderScopeSvg } from './snapshot.ts';
import { slugify } from './slug.ts';

const DEFAULT_FILE = fileURLToPath(new URL('../../public/data/project-architecture.json', import.meta.url));

const HELP = `canvas — draw architecture maps from your terminal

Usage
  ./canvas maps                     list maps (top-level scopes)
  ./canvas read [map]               print a map (or all maps) as DSL
  ./canvas apply [dsl-file]         create/replace maps from DSL (file or stdin)
  ./canvas rm <map> [node|zone]   remove a node or zone (zones cascade), or a whole map
  ./canvas snapshot <map> [-o out]  render a map to SVG
  ./canvas help                     this text

  --file <path>   use another architecture JSON (default: public/data/project-architecture.json)

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

  node kinds    module | object | runtime | resource | tree   (note = free-text comment)
  zones         zone "Stores" ... end                nested containers; zones nest
                inside scopes and inside each other; labels unique per map
  methods       name(TypeA, TypeB) -> TypeC            under a node; bare type names
  types         type Name { fieldA, fieldB }           under a node
  rows          row <id> <kind> [status] [parent=<id>] [badges=a,b] [label "text"]
                under a tree node; kind: project|mission|task|bucket
  wires         wire A -> B : <the actual call> [kind]
                kind: owns|references|assigns|queries|executes|mentions|missing
  names         quote multi-word names: "browse CLI"; single tokens can go bare
`;

interface Args { verb: string; positional: string[]; file: string; out?: string }

function parseArgs(argv: string[]): Args {
  const args: Args = { verb: argv[0] ?? 'help', positional: [], file: DEFAULT_FILE };
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--file') args.file = argv[(index += 1)];
    else if (argv[index] === '-o' || argv[index] === '--out') args.out = argv[(index += 1)];
    else args.positional.push(argv[index]);
  }
  return args;
}

function findScope(doc: ArchitectureDocument, query: string): string | undefined {
  const querySlug = slugify(query);
  return Object.values(doc.nodes).find(
    (node) => node.kind === 'scope' && !node.parentId && (node.id === query || slugify(node.label) === querySlug),
  )?.id;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function scopeOrFail(doc: ArchitectureDocument, query: string): string {
  const scopeId = findScope(doc, query);
  if (!scopeId) {
    fail(`no map "${query}" — available: ${listMaps(doc).map((map) => map.id).join(', ')}`);
  }
  return scopeId;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.verb === 'help' || args.verb === '--help' || args.verb === '-h') {
    process.stdout.write(HELP);
    return;
  }

  if (args.verb === 'maps') {
    const doc = await loadDocument(args.file);
    const maps = listMaps(doc);
    const width = Math.max(...maps.map((map) => map.id.length), 2);
    for (const map of maps) {
      process.stdout.write(`${map.id.padEnd(width)}  ${String(map.nodes).padStart(3)} nodes  ${String(map.wires).padStart(3)} wires  ${map.label}\n`);
    }
    return;
  }

  if (args.verb === 'read') {
    const doc = await loadDocument(args.file);
    if (args.positional.length === 0) {
      process.stdout.write(printOutline(doc));
      return;
    }
    process.stdout.write(printScope(doc, scopeOrFail(doc, args.positional[0])));
    return;
  }

  if (args.verb === 'apply') {
    let source: string;
    if (args.positional[0]) source = readFileSync(args.positional[0], 'utf8');
    else if (process.stdin.isTTY) fail('apply needs DSL: pass a file, or pipe it in. See ./canvas help');
    else source = readFileSync(0, 'utf8');

    const { scopes, errors: parseErrors } = parseDsl(source);
    if (scopes.length === 0 && parseErrors.length === 0) fail('no scopes found in the DSL. See ./canvas help');
    const doc = await loadDocument(args.file);
    const compiled = compile(doc, scopes);
    const allErrors = [
      ...parseErrors.map((error) => `line ${error.line}: ${error.message}\n  fix: ${error.hint}`),
      ...compiled.errors.map((error) => `${error.message}\n  fix: ${error.hint}`),
    ];
    if (allErrors.length > 0) {
      fail(`${allErrors.length} error(s), nothing written:\n${allErrors.join('\n')}`);
    }
    const laid = layoutScopes(compiled.doc, compiled.touchedScopeIds);
    for (const warning of compiled.warnings) process.stderr.write(`warning: ${warning}\n`);
    for (const scopeId of compiled.touchedScopeIds) {
      for (const label of overlappingScopes(laid, scopeId)) {
        process.stderr.write(`warning: "${laid.nodes[scopeId].label}" now overlaps "${label}" — drag or re-apply that map\n`);
      }
    }
    const revision = await saveDocument(args.file, laid);
    const labels = compiled.touchedScopeIds.map((scopeId) => laid.nodes[scopeId].label).join(', ');
    process.stdout.write(`applied: ${labels} (revision ${revision})\n`);
    return;
  }

  if (args.verb === 'rm') {
    if (args.positional.length === 0) fail('rm needs a map (and optionally a node): ./canvas rm <map> [node]');
    const doc = await loadDocument(args.file);
    const scopeId = scopeOrFail(doc, args.positional[0]);
    const nodes = { ...doc.nodes };
    const interfaces = { ...doc.interfaces };
    const types = { ...doc.types };
    const wires = { ...doc.wires };

    const removeNode = (id: string): void => {
      for (const interfaceId of nodes[id].interfaceIds) delete interfaces[interfaceId];
      for (const typeId of nodes[id].typeIds) delete types[typeId];
      delete nodes[id];
      for (const [wireId, wire] of Object.entries(wires)) {
        if (wire.source === id || wire.target === id) delete wires[wireId];
      }
    };

    let removedLabel: string;
    if (args.positional[1]) {
      const nameSlug = slugify(args.positional[1]);
      const descendantIds = (rootId: string): string[] => {
        const result: string[] = [];
        const queue = [rootId];
        while (queue.length > 0) {
          const current = queue.shift() as string;
          for (const node of Object.values(nodes)) {
            if (node.parentId === current) {
              result.push(node.id);
              queue.push(node.id);
            }
          }
        }
        return result;
      };
      const target = descendantIds(scopeId)
        .map((id) => nodes[id])
        .find((node) => slugify(node.label) === nameSlug);
      if (!target) fail(`no node "${args.positional[1]}" in ${scopeId}`);
      removedLabel = target.label;
      // Removing a zone cascades its whole descendant closure (ruling R4).
      for (const id of descendantIds(target.id)) removeNode(id);
      removeNode(target.id);
    } else {
      removedLabel = nodes[scopeId].label;
      const queue = [scopeId];
      while (queue.length > 0) {
        const current = queue.shift() as string;
        for (const node of Object.values(nodes)) {
          if (node.parentId === current) queue.push(node.id);
        }
        removeNode(current);
      }
    }

    let next: ArchitectureDocument = { ...doc, nodes, interfaces, types, wires };
    if (args.positional[1]) next = layoutScopes(next, [scopeId]);
    const revision = await saveDocument(args.file, next);
    process.stdout.write(`removed: ${removedLabel} (revision ${revision})\n`);
    return;
  }

  if (args.verb === 'snapshot') {
    if (args.positional.length === 0) fail('snapshot needs a map: ./canvas snapshot <map> [-o out.svg]');
    const doc = await loadDocument(args.file);
    const scopeId = scopeOrFail(doc, args.positional[0]);
    const out = args.out ?? `${scopeId}.svg`;
    const { writeFile } = await import('node:fs/promises');
    await writeFile(out, renderScopeSvg(doc, scopeId), 'utf8');
    process.stdout.write(`${out}\n`);
    return;
  }

  process.stdout.write(HELP);
  fail(`unknown verb "${args.verb}"`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
