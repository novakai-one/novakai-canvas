import type { DiagramComponent } from '../../../src/components/component.ts';
import {
  CONTAINER_ALIGNS, GRID_COLUMNS, SPACINGS, appearanceEntry, appearanceSpecification,
  canonicalNodeAppearance, isAppearanceKey, isArrangementKey,
  type AuthoredArrangement, type ParsedPresentation,
} from '../../../src/domain/canvas-presentation.ts';
import { ORIENTATIONS, isOrientation, type Orientation } from '../../../src/domain/axis.ts';
import { attributeKey } from './tokens.ts';

type SplitResult =
  | { semanticTokens: string[]; presentation?: ParsedPresentation; orientation?: Orientation;
      topology?: { band?: number; lane?: number } }
  | { error: string; hint: string };
type Failure = { error: string; hint: string };

interface PresentationContext {
  appearanceKeys: NonNullable<DiagramComponent['appearanceKeys']>;
  arrangementModes: NonNullable<DiagramComponent['arrangementModes']>;
  layoutRole: DiagramComponent['layoutRole'];
  hint: string;
  owner: string;
}

interface AuthoredPresentation {
  appearance: NonNullable<ParsedPresentation['appearance']>;
  arrangement: Partial<AuthoredArrangement>;
  hasArrangementAttribute: boolean;
  orientation?: Orientation;
  topology: { band?: number; lane?: number };
}

/** Which way the map runs is a property of the map, so only its root scope may say it. */
const ORIENTATION_KEY = 'orientation';
const ORIENTATION_HINT = `${ORIENTATION_KEY}=${ORIENTATIONS.join('|')}`;
/** Frame ordinals are per-node, so only leaf components may say them (zones derive from children). */
const TOPOLOGY_KEYS = ['band', 'lane'] as const;
const TOPOLOGY_HINT = '[band=0|1|2|…] [lane=0|1|2|…]';

function contextFor(component: DiagramComponent, tokens: string[]): PresentationContext {
  const arrangementModes = component.arrangementModes ?? [];
  const layoutValues = arrangementModes.join('|');
  const columnsHint = arrangementModes.includes('grid') ? ' [columns=1|2|3|4|5|6]' : '';
  return {
    appearanceKeys: component.appearanceKeys ?? [],
    arrangementModes,
    layoutRole: component.layoutRole,
    owner: tokens[0],
    hint: tokens[0] === 'scope'
      ? `scope "name" ["optional description"] [layout=${layoutValues}]${columnsHint} [gap=0|4|8|12|16|24|32] [align=stretch|start|center|end] [${ORIENTATION_HINT}]`
      : component.layoutRole === 'leaf'
        ? `${component.declaration.syntax} ${TOPOLOGY_HINT}`
        : component.declaration.syntax,
  };
}

function parseColumns(raw: string, arrangement: Partial<AuthoredArrangement>): string | undefined {
  const columns = GRID_COLUMNS.find((candidate) => String(candidate) === raw);
  if (columns === undefined) return `invalid columns "${raw}"; use one of: ${GRID_COLUMNS.join(', ')}`;
  arrangement.columns = columns;
  return undefined;
}

function parseLayout(
  raw: string,
  context: PresentationContext,
  arrangement: Partial<AuthoredArrangement>,
): string | undefined {
  const mode = context.arrangementModes.find((candidate) => candidate === raw);
  if (!mode) return `invalid layout "${raw}"; use one of: ${context.arrangementModes.join(', ')}`;
  arrangement.layout = mode;
  return undefined;
}

function parseGap(raw: string, arrangement: Partial<AuthoredArrangement>): string | undefined {
  const gap = SPACINGS.find((candidate) => String(candidate) === raw);
  if (gap === undefined) return `invalid gap "${raw}"; use one of: ${SPACINGS.join(', ')}`;
  arrangement.gap = gap;
  return undefined;
}

function parseContainerAlign(
  raw: string,
  arrangement: Partial<AuthoredArrangement>,
): string | undefined {
  const align = CONTAINER_ALIGNS.find((candidate) => candidate === raw);
  if (!align) return `invalid align "${raw}"; use one of: ${CONTAINER_ALIGNS.join(', ')}`;
  arrangement.align = align;
  return undefined;
}

function parseArrangement(
  key: string,
  raw: string,
  context: PresentationContext,
  arrangement: Partial<AuthoredArrangement>,
): { handled: boolean; error?: string } {
  if (!isArrangementKey(key) || context.arrangementModes.length === 0) return { handled: false };
  if (key === 'columns') return { handled: true, error: parseColumns(raw, arrangement) };
  if (key === 'layout') return { handled: true, error: parseLayout(raw, context, arrangement) };
  if (key === 'gap') return { handled: true, error: parseGap(raw, arrangement) };
  return { handled: true, error: parseContainerAlign(raw, arrangement) };
}

function parseAppearance(
  key: string,
  raw: string,
  context: PresentationContext,
  appearance: NonNullable<ParsedPresentation['appearance']>,
): { handled: boolean; error?: string } {
  if (!isAppearanceKey(key) || !context.appearanceKeys.includes(key)) return { handled: false };
  const entry = appearanceEntry(key, raw);
  if (!entry) {
    return {
      handled: true,
      error: `invalid ${key} "${raw}"; use one of: ${appearanceSpecification(key).values.join(', ')}`,
    };
  }
  (appearance as Record<string, unknown>)[entry.jsonKey] = entry.value;
  return { handled: true };
}

function arrangementFailure(
  arrangement: Partial<AuthoredArrangement>,
  context: PresentationContext,
  hasArrangementAttribute: boolean,
): Failure | undefined {
  const layoutValues = context.arrangementModes.join('|');
  if (hasArrangementAttribute && arrangement.layout === undefined) {
    return {
      error: `container columns, gap and align require layout=${layoutValues.replaceAll('|', ' or layout=')}`,
      hint: context.hint,
    };
  }
  if (arrangement.layout === 'grid' && arrangement.columns === undefined) {
    return { error: 'layout=grid requires columns=1|2|3|4|5|6', hint: context.hint };
  }
  if (arrangement.layout !== undefined
    && arrangement.layout !== 'grid' && arrangement.columns !== undefined) {
    return { error: 'columns is only valid with layout=grid', hint: context.hint };
  }
  return undefined;
}

function parseTopologyOrdinal(
  key: string,
  raw: string,
  context: PresentationContext,
  topology: { band?: number; lane?: number },
): string | undefined {
  if (context.layoutRole !== 'leaf') {
    return `${key} belongs on a leaf node; containers derive their frame from their children`;
  }
  if (!/^\d+$/.test(raw)) return `invalid ${key} "${raw}"; use a non-negative integer`;
  topology[key as 'band' | 'lane'] = Number(raw);
  return undefined;
}

function parseAttributes(
  tokens: string[],
  firstAttribute: number,
  context: PresentationContext,
): AuthoredPresentation | Failure {
  const appearance: NonNullable<ParsedPresentation['appearance']> = {};
  const arrangement: Partial<AuthoredArrangement> = {};
  const topology: { band?: number; lane?: number } = {};
  let hasArrangementAttribute = false;
  let orientation: Orientation | undefined;
  const seen = new Set<string>();
  for (const token of tokens.slice(firstAttribute)) {
    const equals = token.indexOf('=');
    const key = equals < 1 ? token : token.slice(0, equals);
    const raw = equals < 1 ? '' : token.slice(equals + 1);
    if (seen.has(key)) return { error: `duplicate attribute "${key}"`, hint: context.hint };
    seen.add(key);
    if (key === ORIENTATION_KEY) {
      if (context.owner !== 'scope') {
        return {
          error: `${ORIENTATION_KEY} belongs on the map's root scope, not on ${context.owner}`,
          hint: `move ${ORIENTATION_HINT} to the scope line`,
        };
      }
      if (!isOrientation(raw)) {
        return {
          error: `invalid ${ORIENTATION_KEY} "${raw}"; use one of: ${ORIENTATIONS.join(', ')}`,
          hint: context.hint,
        };
      }
      orientation = raw;
      continue;
    }
    if ((TOPOLOGY_KEYS as readonly string[]).includes(key)) {
      const error = parseTopologyOrdinal(key, raw, context, topology);
      if (error) return { error, hint: context.hint };
      continue;
    }
    const arrangementResult = parseArrangement(key, raw, context, arrangement);
    if (arrangementResult.handled) {
      hasArrangementAttribute = true;
      if (arrangementResult.error) return { error: arrangementResult.error, hint: context.hint };
      continue;
    }
    const appearanceResult = parseAppearance(key, raw, context, appearance);
    if (!appearanceResult.handled) {
      return { error: `unknown attribute "${key}" for ${context.owner}`, hint: context.hint };
    }
    if (appearanceResult.error) return { error: appearanceResult.error, hint: context.hint };
  }
  return { appearance, arrangement, hasArrangementAttribute, orientation, topology };
}

/** Strips and validates shared presentation tokens against component metadata. */
export function splitPresentation(component: DiagramComponent, tokens: string[]): SplitResult {
  const context = contextFor(component, tokens);
  const firstAttribute = tokens.findIndex((token, index) => {
    if (index < 2) return false;
    const key = attributeKey(token) ?? '';
    return key === ORIENTATION_KEY
      // Topology keys are detected for every role so a container gets the leaf-only
      // error instead of silently reading `band=` as its description.
      || (TOPOLOGY_KEYS as readonly string[]).includes(key)
      || (isAppearanceKey(key) && context.appearanceKeys.includes(key))
      || (context.arrangementModes.length > 0 && isArrangementKey(key));
  });
  if (firstAttribute === -1) return { semanticTokens: tokens };
  const authored = parseAttributes(tokens, firstAttribute, context);
  if ('error' in authored) return authored;
  const { appearance, arrangement, hasArrangementAttribute, orientation, topology } = authored;
  const failure = arrangementFailure(arrangement, context, hasArrangementAttribute);
  if (failure) return failure;
  const parsed: ParsedPresentation = {};
  if (Object.keys(appearance).length > 0) parsed.appearance = canonicalNodeAppearance(appearance);
  if (arrangement.layout !== undefined) {
    parsed.arrangement = {
      layout: arrangement.layout,
      gap: arrangement.gap ?? 16,
      align: arrangement.align ?? 'stretch',
      ...(arrangement.columns === undefined ? {} : { columns: arrangement.columns }),
    };
  }
  return {
    semanticTokens: tokens.slice(0, firstAttribute),
    ...(Object.keys(parsed).length > 0 ? { presentation: parsed } : {}),
    ...(orientation === undefined ? {} : { orientation }),
    ...(topology.band === undefined && topology.lane === undefined ? {} : { topology }),
  };
}
