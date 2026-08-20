import type { DiagramComponent } from '../../../src/components/component.ts';
import {
  CONTAINER_ALIGNS, GRID_COLUMNS, SPACINGS, appearanceEntry, appearanceSpecification,
  canonicalNodeAppearance, isAppearanceKey, isArrangementKey, isPresentationAttributeKey,
  type AuthoredArrangement, type ParsedPresentation,
} from '../../../src/domain/canvas-presentation.ts';
import { attributeKey } from './tokens.ts';

type SplitResult =
  | { semanticTokens: string[]; presentation?: ParsedPresentation }
  | { error: string; hint: string };
type Failure = { error: string; hint: string };

interface PresentationContext {
  appearanceKeys: NonNullable<DiagramComponent['appearanceKeys']>;
  arrangementModes: NonNullable<DiagramComponent['arrangementModes']>;
  hint: string;
  owner: string;
}

interface AuthoredPresentation {
  appearance: NonNullable<ParsedPresentation['appearance']>;
  arrangement: Partial<AuthoredArrangement>;
  hasArrangementAttribute: boolean;
}

function contextFor(component: DiagramComponent, tokens: string[]): PresentationContext {
  const arrangementModes = component.arrangementModes ?? [];
  const layoutValues = arrangementModes.join('|');
  const columnsHint = arrangementModes.includes('grid') ? ' [columns=1|2|3|4|5|6]' : '';
  return {
    appearanceKeys: component.appearanceKeys ?? [],
    arrangementModes,
    owner: tokens[0],
    hint: tokens[0] === 'scope'
      ? `scope "name" ["optional description"] [layout=${layoutValues}]${columnsHint} [gap=0|4|8|12|16|24|32] [align=stretch|start|center|end]`
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

function parseAttributes(
  tokens: string[],
  firstAttribute: number,
  context: PresentationContext,
): AuthoredPresentation | Failure {
  const appearance: NonNullable<ParsedPresentation['appearance']> = {};
  const arrangement: Partial<AuthoredArrangement> = {};
  let hasArrangementAttribute = false;
  const seen = new Set<string>();
  for (const token of tokens.slice(firstAttribute)) {
    const equals = token.indexOf('=');
    const key = equals < 1 ? token : token.slice(0, equals);
    const raw = equals < 1 ? '' : token.slice(equals + 1);
    if (seen.has(key)) return { error: `duplicate attribute "${key}"`, hint: context.hint };
    seen.add(key);
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
  return { appearance, arrangement, hasArrangementAttribute };
}

/** Strips and validates shared presentation tokens against component metadata. */
export function splitPresentation(component: DiagramComponent, tokens: string[]): SplitResult {
  const context = contextFor(component, tokens);
  const firstAttribute = tokens.findIndex((token, index) => index >= 2
    && isPresentationAttributeKey(attributeKey(token) ?? ''));
  if (firstAttribute === -1) return { semanticTokens: tokens };
  const authored = parseAttributes(tokens, firstAttribute, context);
  if ('error' in authored) return authored;
  const { appearance, arrangement, hasArrangementAttribute } = authored;
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
  };
}
