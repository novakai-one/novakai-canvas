/** Canvas CLI composition root. */

import { parseArgs, fail } from './cli-args.ts';
import { CLI_HELP, describeCapability } from './cli-contract.ts';
import { runApply, runCheck, runSnapshot } from './cli-authoring.ts';
import { runBatch, runFlows, runMaps, runRead, runRemove } from './cli-library.ts';
import { openLibrary } from './library-io.ts';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.verb === 'help' || args.verb === '--help' || args.verb === '-h') {
    process.stdout.write(CLI_HELP);
    return;
  }
  if (args.verb === 'describe') {
    process.stdout.write(`${JSON.stringify(describeCapability(), null, 2)}\n`);
    return;
  }
  if (args.verb === 'check') return runCheck(args);
  if (!['maps', 'flows', 'read', 'apply', 'rm', 'snapshot', 'batch'].includes(args.verb)) {
    process.stdout.write(CLI_HELP);
    fail(`unknown verb "${args.verb}"`);
  }
  const opened = await openLibrary(args.dataDir, args.positional[0] ?? 'stdin');
  if (args.verb === 'maps') return runMaps(opened);
  if (args.verb === 'flows') return runFlows(opened, args);
  if (args.verb === 'read') return runRead(opened, args);
  if (args.verb === 'apply') return runApply(opened, args);
  if (args.verb === 'batch') return runBatch(opened, args);
  if (args.verb === 'rm') {
    if (args.positional.length === 0) fail('rm needs a map (and optionally a node): ./canvas rm <map> [node]');
    return runRemove(opened, args);
  }
  return runSnapshot(opened, args);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
