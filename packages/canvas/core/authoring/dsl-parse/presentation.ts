import type { DiagramComponent } from '../../components/component.ts';
import {
  canonicalNodeAppearance, isAppearanceKey, isArrangementKey,
  type AuthoredArrangement, type ParsedPresentation,
} from '../../../contract/schemas/presentation.ts';
import { ORIENTATIONS, isOrientation, type Orientation } from '../../../contract/types/orientation.ts';
import type { CrossingPolicy } from '../../domain/topology.ts';
import { attributeKey } from './tokens.ts';
import {
  arrangementFailure, parseAppearance, parseArrangement, type PresentationContext,
} from './presentation-arrangement.ts';

type SplitResult =
  | { semanticTokens: string[]; presentation?: ParsedPresentation; orientation?: Orientation;
      topology?: { band?: number; lane?: number };
      boundary?: { crossing?: CrossingPolicy; gateLabel?: string } }
  | { error: string; hint: string };
type Failure = { error: string; hint: string };

interface AuthoredPresentation {
  appearance: NonNullable<ParsedPresentation['appearance']>;
  arrangement: Partial<AuthoredArrangement>;
  hasArrangementAttribute: boolean;
  orientation?: Orientation;
  topology: { band?: number; lane?: number };
  boundary: { crossing?: CrossingPolicy; gateLabel?: string };
}

/** Which way the map runs is a property of the map, so only its root scope may say it. */
const ORIENTATION_KEY = 'orientation';
const ORIENTATION_HINT = `${ORIENTATION_KEY}=${ORIENTATIONS.join('|')}`;
/** Frame ordinals are per-node, so only leaf components may say them (zones derive from children). */
const TOPOLOGY_KEYS = ['band', 'lane'] as const;
const TOPOLOGY_HINT = '[band=0|1|2|…] [lane=0|1|2|…]';
const BOUNDARY_KEYS = ['crossing', 'gate'] as const;
const BOUNDARY_HINT = '[crossing=gated|free] [gate="node label"]';

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
        : `${component.declaration.syntax} ${BOUNDARY_HINT}`,
  };
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

function parseBoundaryAttribute(
  key: string,
  raw: string,
  context: PresentationContext,
  boundary: { crossing?: CrossingPolicy; gateLabel?: string },
): string | undefined {
  if (context.owner !== 'zone') return `${key} belongs on a zone, not on ${context.owner}`;
  if (key === 'gate') {
    if (raw.length === 0) return 'gate needs a node label';
    boundary.gateLabel = raw;
    return undefined;
  }
  if (raw !== 'gated' && raw !== 'free') {
    return `invalid crossing "${raw}"; use one of: gated, free`;
  }
  boundary.crossing = raw;
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
  const boundary: { crossing?: CrossingPolicy; gateLabel?: string } = {};
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
    if ((BOUNDARY_KEYS as readonly string[]).includes(key)) {
      const error = parseBoundaryAttribute(key, raw, context, boundary);
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
  return { appearance, arrangement, hasArrangementAttribute, orientation, topology, boundary };
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
      || (BOUNDARY_KEYS as readonly string[]).includes(key)
      || (isAppearanceKey(key) && context.appearanceKeys.includes(key))
      || (context.arrangementModes.length > 0 && isArrangementKey(key));
  });
  if (firstAttribute === -1) return { semanticTokens: tokens };
  const authored = parseAttributes(tokens, firstAttribute, context);
  if ('error' in authored) return authored;
  const {
    appearance, arrangement, hasArrangementAttribute, orientation, topology, boundary,
  } = authored;
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
    ...(boundary.crossing === undefined && boundary.gateLabel === undefined ? {} : { boundary }),
  };
}
