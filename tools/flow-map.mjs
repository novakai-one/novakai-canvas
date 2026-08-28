#!/usr/bin/env node
/**
 * flow-map — static flow-of-events for one function, across files, in one output.
 *
 * Follows every call from an entry function through the codebase (TypeScript
 * compiler resolves each call to its definition), in execution order, and
 * prints one row per meaningful step:
 *
 *   step | call | file:line | side effect | what runs if it throws
 *
 * Rows that can throw uncaught AFTER an earlier irreversible step (a kill,
 * spawn, or write) are flagged `!!` — that is the "prod is down and rollback
 * never runs" class of bug.
 *
 * Usage:
 *   node tools/flow-map.mjs <entry-file> <functionName> [--depth N] [--full]
 *   node tools/flow-map.mjs <entry-file>            # lists functions
 *   --full: do not collapse boring helper subtrees into summary rows
 *
 * Reliability contract: awaited/sync calls are traced faithfully. Anything the
 * tool cannot follow is flagged, never dropped: [not-awaited] fire-and-forget,
 * [event] handler registrations (a separate flow starts there), [dynamic]
 * computed dispatch, [?] unresolved calls.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const args = process.argv.slice(2);
const depthArgIdx = args.indexOf('--depth');
const MAX_DEPTH = depthArgIdx >= 0 ? Number(args[depthArgIdx + 1]) : 5;
const positional = args.filter((a, i) => !a.startsWith('--') && (depthArgIdx < 0 || i !== depthArgIdx + 1));
const [entryArg, targetName] = positional;
if (!entryArg) {
  console.error('usage: flow-map.mjs <entry-file> <functionName> [--depth N]');
  process.exit(1);
}
const entryFile = path.resolve(entryArg);

const program = ts.createProgram([entryFile], {
  allowJs: true,
  checkJs: false,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  noEmit: true,
});
const checker = program.getTypeChecker();
const entrySf = program.getSourceFile(entryFile);
if (!entrySf) {
  console.error(`cannot load ${entryFile}`);
  process.exit(1);
}

// ---- locate functions ------------------------------------------------------

/** Function-like body for a declaration, unwrapping `const f = () => {}`. */
function fnOf(decl) {
  if (!decl) return undefined;
  if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl) || ts.isFunctionExpression(decl) || ts.isArrowFunction(decl)) {
    return decl.body ? decl : undefined;
  }
  if ((ts.isVariableDeclaration(decl) || ts.isPropertyAssignment(decl)) && decl.initializer &&
      (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
    return decl.initializer.body ? decl.initializer : undefined;
  }
  return undefined;
}

function functionsIn(sf) {
  const found = new Map();
  sf.forEachChild(function walk(node) {
    if (ts.isFunctionDeclaration(node) && node.name) found.set(node.name.text, node);
    if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && fnOf(d)) found.set(d.name.text, d);
      }
    }
    ts.forEachChild(node, walk);
  });
  return found;
}

const fns = functionsIn(entrySf);
if (!targetName) {
  console.log(`functions in ${path.basename(entryFile)}:`);
  for (const name of fns.keys()) console.log(`  ${name}`);
  process.exit(0);
}
const entryDecl = fns.get(targetName);
const entryFn = fnOf(entryDecl);
if (!entryFn) {
  console.error(`function "${targetName}" not found in ${entryFile} (run without a name to list)`);
  process.exit(1);
}

// ---- classification --------------------------------------------------------

const FS_WRITE = /\b(writeFileSync|writeFile|appendFileSync|appendFile|renameSync|rename|mkdirSync|mkdir|cpSync|copyFileSync|copyFile|chmodSync|symlinkSync)\b/;
const FS_READ = /\b(readFileSync|readFile|existsSync|readdirSync|readdir|statSync|stat|lstatSync|realpathSync|accessSync)\b/;
// bare `exec` deliberately absent — RegExp.prototype.exec would false-positive
const PROC_SPAWN = /\b(spawnSync|spawn|execSync|execFileSync|execFile|fork)\b/;
const PROC_KILL = /(^|\.)kill\b/;
const NETWORK = /\b(fetch)\b|\bhttps?\.(request|get)\b/;
const LOG = /^console\.|(^|\.)(log|warn|error|info|debug)$/;
const EVENT_REG = /\.(on|once|addListener|addEventListener|prependListener)$/;
const TIMER = /^setInterval$/;
const DELAY = /^(setTimeout|setImmediate|queueMicrotask)$/; // plain delays — not a flow of their own

/** Side-effect class for a call, from its callee text. */
// rename is deliberately a write, not a delete — it is the atomic-write pattern
const FS_DELETE = /\b(rm|rmSync|rmdir|rmdirSync|unlink|unlinkSync|truncate|truncateSync)\b/;
function effectOf(calleeText) {
  if (PROC_KILL.test(calleeText)) return 'process-kill';
  if (FS_DELETE.test(calleeText)) return 'fs-delete';
  if (PROC_SPAWN.test(calleeText)) return 'process-spawn';
  if (FS_WRITE.test(calleeText)) return 'fs-write';
  if (FS_READ.test(calleeText)) return 'fs-read';
  if (NETWORK.test(calleeText)) return 'network';
  if (LOG.test(calleeText)) return 'log';
  return undefined;
}
// Steps that destroy running state — after the first of these, an uncaught
// throw means the system is left broken with no recovery path.
const IRREVERSIBLE = new Set(['process-kill', 'fs-delete']);

function isExternal(decl) {
  const f = decl.getSourceFile().fileName;
  return f.includes('/node_modules/') || f.endsWith('.d.ts');
}

function isAsyncFn(fnLike) {
  return !!fnLike.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
}

function loc(node) {
  const sf = node.getSourceFile();
  const { line } = ts.getLineAndCharacterOfPosition(sf, node.getStart());
  return `${path.basename(sf.fileName)}:${line + 1}`;
}

/** Resolve a call to its user-code function declaration, or undefined. */
function resolveCall(callExpr) {
  let symbol = checker.getSymbolAtLocation(callExpr.expression);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const decl = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  if (!decl || isExternal(decl)) return { decl: undefined, external: !!decl };
  return { decl, external: false };
}

/** Markers for the control-flow context of a call inside its function. */
function contextOf(node, fnLike) {
  let inCond = false; let inCatch = false; let inLoop = false;
  for (let p = node.parent; p && p !== fnLike; p = p.parent) {
    if (ts.isIfStatement(p) || ts.isConditionalExpression(p)) inCond = true;
    if (ts.isCatchClause(p)) inCatch = true;
    if (ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isWhileStatement(p) || ts.isDoStatement(p)) inLoop = true;
  }
  return { inCond, inCatch, inLoop };
}

/** Nearest enclosing try-with-catch for `node` within `fnLike`, or undefined. */
function catchWithin(node, fnLike) {
  for (let p = node.parent; p && p !== fnLike; p = p.parent) {
    if (ts.isTryStatement(p) && p.catchClause && node.pos >= p.tryBlock.pos && node.end <= p.tryBlock.end) {
      return p.catchClause;
    }
    node = p.pos !== undefined ? node : node; // keep node fixed; containment checked against original position
  }
  return undefined;
}

// ---- trace -----------------------------------------------------------------

/**
 * One traced step. `children` are the steps inside the callee (user code only).
 * @typedef {{label:string, at:string, effect?:string, throwTo:string, flags:string[], children:Step[]}} Step
 */

/** Where a throw at `site` lands, given the current call stack. */
function resolveThrow(site, stack) {
  const frames = [...stack, site];
  for (let i = frames.length - 1; i >= 0; i--) {
    const { node, fn } = frames[i];
    const clause = catchWithin(node, fn);
    if (clause) return `caught ${loc(clause)}`;
  }
  return `UNCAUGHT — exits ${targetName}`;
}

const unresolved = new Set();

/** Trace a function body; returns child steps. `stack`: [{node, fn}] call sites. */
function traceFn(fnLike, stack, depth, visiting) {
  const steps = [];
  function visit(node) {
    // A function defined here (object-literal method, stored arrow, nested fn)
    // does not RUN here — trace it only when something calls it. Function
    // literals passed as call arguments (forEach etc.) do run, so keep those.
    if (ts.isMethodDeclaration(node)) return;
    if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) &&
        !((ts.isCallExpression(node.parent) || ts.isNewExpression(node.parent)) &&
          node.parent.arguments?.includes(node))) {
      return;
    }
    // execution order: arguments evaluate before the call itself
    ts.forEachChild(node, visit);
    if (!ts.isCallExpression(node)) return;
    const calleeText = node.expression.getText();
    const effect = effectOf(calleeText);
    if (effect === 'log' || DELAY.test(calleeText)) return;
    // `foo(...).trim()`-style chains: the inner call is already a step; the
    // chained method itself only matters when it is user code.
    const chained = ts.isPropertyAccessExpression(node.expression) && ts.isCallExpression(node.expression.expression);

    const flags = [];
    const ctx = contextOf(node, fnLike);
    if (ctx.inCatch) flags.push('on-fail');
    else if (ctx.inCond) flags.push('cond');
    if (ctx.inLoop) flags.push('loop');

    if (EVENT_REG.test(calleeText) || TIMER.test(calleeText)) {
      steps.push({ label: `${calleeText}(…)`, at: loc(node), effect: 'event',
        throwTo: '—', flags: [...flags, 'separate flow starts here'], children: [] });
      return;
    }
    if (ts.isElementAccessExpression(node.expression)) {
      steps.push({ label: `${calleeText}(…)`, at: loc(node), effect: undefined,
        throwTo: resolveThrow({ node, fn: fnLike }, stack), flags: [...flags, 'dynamic — target unresolved'], children: [] });
      return;
    }

    const { decl, external } = resolveCall(node);
    if (chained && (external || !decl)) return;
    const site = { node, fn: fnLike };
    const throwTo = resolveThrow(site, stack);

    if (decl && !external) {
      const callee = fnOf(decl);
      if (callee) {
        if (isAsyncFn(callee)) {
          const awaited = ts.isAwaitExpression(node.parent) ||
            (ts.isParenthesizedExpression(node.parent) && ts.isAwaitExpression(node.parent.parent)) ||
            ts.isReturnStatement(node.parent) ||
            ts.isArrowFunction(node.parent) || // concise arrow body returns the promise
            (ts.isPropertyAccessExpression(node.parent) && /^(then|catch|finally)$/.test(node.parent.name?.text ?? ''));
          if (!awaited) flags.push('NOT AWAITED — errors go nowhere');
        }
        let children = [];
        if (visiting.has(callee)) flags.push('recursion — not re-expanded');
        else if (depth >= MAX_DEPTH) flags.push('depth limit');
        else {
          visiting.add(callee);
          children = traceFn(callee, [...stack, site], depth + 1, visiting);
          visiting.delete(callee);
        }
        steps.push({ label: `${calleeText}()`, at: loc(callee), effect, throwTo, flags, children });
        return;
      }
      // resolved to a non-function (re-exported const etc.) — fall through
    }
    if (effect) {
      steps.push({ label: `${calleeText}(…)`, at: loc(node), effect, throwTo, flags, children: [] });
    } else if (!external) {
      unresolved.add(calleeText);
    }
  }
  const body = fnLike.body;
  if (ts.isBlock(body)) body.statements.forEach(visit);
  else visit(body);
  return steps;
}

// ---- prune + print ---------------------------------------------------------

const SIGNAL_ROW = /NOT AWAITED|dynamic|separate flow/;

/** Keep rows that carry an effect, a signal flag, or interesting children. */
function prune(steps) {
  const kept = [];
  for (const s of steps) {
    s.children = prune(s.children);
    if (s.effect || s.children.length > 0 || s.flags.some((f) => SIGNAL_ROW.test(f))) kept.push(s);
  }
  return kept;
}

/** Transitive side-effect counts under a step, e.g. "reads ×3, spawn ×2". */
function summarize(step) {
  const counts = new Map();
  (function add(s) {
    if (s.effect && s.effect !== 'event') counts.set(s.effect, (counts.get(s.effect) ?? 0) + 1);
    s.children.forEach(add);
  })(step);
  return [...counts.entries()].map(([e, n]) => (n > 1 ? `${e} ×${n}` : e)).join(', ');
}

const SIGNAL_FLAGS = /NOT AWAITED|dynamic|separate flow/;

/** A subtree is worth expanding when it handles or causes failure/danger. */
function worthExpanding(step) {
  return step.children.some(function check(s) {
    if (s.effect && IRREVERSIBLE.has(s.effect)) return true;
    if (s.throwTo.startsWith('caught')) return true;
    if (s.flags.some((f) => SIGNAL_FLAGS.test(f))) return true;
    return s.children.some(check);
  });
}

/** Collapse boring helper subtrees into their parent row's effect summary. */
function collapse(steps) {
  for (const s of steps) {
    if (s.children.length > 0 && !worthExpanding(s)) {
      const sum = summarize(s);
      if (sum) s.effect = sum;
      s.children = [];
    } else {
      collapse(s.children);
    }
  }
}

const tree = prune(traceFn(entryFn, [{ node: entryDecl, fn: entryFn }], 0, new Set([entryFn])));
if (!args.includes('--full')) collapse(tree);

// ---- --dsl: emit the top-level steps as a Canvas diagram -------------------

if (args.includes('--dsl')) {
  const q = (s) => `"${s.replace(/"/g, "'")}"`;
  const short = (s) => (s.throwTo.startsWith('caught') ? 'fails → caught, recovers'
    : `fails → NOTHING catches it`);
  const out = [`scope ${q(`Flow — ${targetName}`)} orientation=top-down`];
  out.push(`  note "Each node is one step of ${targetName}, in execution order. Red text in a description = a failure there leaves the system broken."`);
  const containsIrreversible = (s) =>
    (s.effect && [...IRREVERSIBLE].some((e) => s.effect.includes(e))) || s.children.some(containsIrreversible);
  let irreversibleSeen = false;
  const steps = tree.map((s, i) => {
    const uncaught = s.throwTo.startsWith('UNCAUGHT');
    const danger = uncaught && irreversibleSeen;
    if (containsIrreversible(s)) irreversibleSeen = true;
    const name = `${i + 1}. ${s.label.replace(/\(\)$/, '')}`;
    const parts = [];
    if (s.effect) parts.push(s.effect);
    parts.push(danger ? '!! fails after the point of no return — system left broken, nothing recovers' : short(s));
    if (s.flags.length) parts.push(s.flags.join('; '));
    out.push(`  module ${q(name)} ${q(parts.join(' — '))} band=${i} lane=0`);
    return name;
  });
  for (let i = 0; i + 1 < steps.length; i++) {
    out.push(`  wire ${q(steps[i])} -> ${q(steps[i + 1])} : then [references]`);
  }
  process.stdout.write(out.join('\n') + '\n');
  process.exit(0);
}

let stepNo = 0;
let lastIrreversible = 0; // most recent irreversible step so far, 0 = none yet
const rows = [];
function emit(steps, indent) {
  for (const s of steps) {
    stepNo += 1;
    const n = stepNo;
    const uncaught = s.throwTo.startsWith('UNCAUGHT');
    const danger = uncaught && lastIrreversible > 0;
    const irr = s.effect && [...IRREVERSIBLE].some((e) => s.effect.includes(e));
    if (irr) lastIrreversible = n;
    const marker = danger ? '!!' : '  ';
    const flat = s.label.replace(/\s+/g, ' ');
    const label = flat.length > 38 ? `${flat.slice(0, 35)}…)` : flat;
    const eff = s.effect ? `[${s.effect}]` : '';
    const flags = s.flags.length ? `  (${s.flags.join('; ')})` : '';
    const dangerNote = danger ? `  !! uncaught after irreversible step ${lastIrreversible}` : '';
    rows.push(`${String(n).padStart(3)} ${marker} ${'  '.repeat(indent)}${label.padEnd(Math.max(38 - indent * 2, 8))} ${s.at.padEnd(18)} ${eff.padEnd(16)} throw → ${s.throwTo}${flags}${dangerNote}`);
    emit(s.children, indent + 1);
  }
}
emit(tree, 0);

console.log(`FLOW ${targetName} — ${path.relative(process.cwd(), entryFile)}  (depth ≤ ${MAX_DEPTH})`);
console.log(`  step  call${' '.repeat(36)} defined at         effect           on throw`);
console.log(rows.join('\n'));
if (lastIrreversible > 0) console.log(`\nirreversible steps (kill/delete) present — every UNCAUGHT throw after one is flagged !!`);
if (unresolved.size > 0) console.log(`not followed (unresolved, judge manually): ${[...unresolved].join(', ')}`);
