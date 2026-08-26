import type { DiagramComponent } from '../../components/component.ts';
import {
  CONTAINER_ALIGNS, GRID_COLUMNS, SPACINGS, appearanceEntry, appearanceSpecification,
  isAppearanceKey, isArrangementKey, type AuthoredArrangement, type ParsedPresentation,
} from '../../../contract/schemas/presentation.ts';

export interface PresentationContext {
  appearanceKeys: NonNullable<DiagramComponent['appearanceKeys']>;
  arrangementModes: NonNullable<DiagramComponent['arrangementModes']>;
  layoutRole: DiagramComponent['layoutRole'];
  hint: string;
  owner: string;
}

function parseColumns(raw: string, arrangement: Partial<AuthoredArrangement>): string | undefined {
  const columns = GRID_COLUMNS.find((candidate) => String(candidate) === raw);
  if (columns === undefined) return `invalid columns "${raw}"; use one of: ${GRID_COLUMNS.join(', ')}`;
  arrangement.columns = columns;
  return undefined;
}

function parseLayout(
  raw: string, context: PresentationContext, arrangement: Partial<AuthoredArrangement>,
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

function parseContainerAlign(raw: string, arrangement: Partial<AuthoredArrangement>): string | undefined {
  const align = CONTAINER_ALIGNS.find((candidate) => candidate === raw);
  if (!align) return `invalid align "${raw}"; use one of: ${CONTAINER_ALIGNS.join(', ')}`;
  arrangement.align = align;
  return undefined;
}

export function parseArrangement(
  key: string, raw: string, context: PresentationContext,
  arrangement: Partial<AuthoredArrangement>,
): { handled: boolean; error?: string } {
  if (!isArrangementKey(key) || context.arrangementModes.length === 0) return { handled: false };
  if (key === 'columns') return { handled: true, error: parseColumns(raw, arrangement) };
  if (key === 'layout') return { handled: true, error: parseLayout(raw, context, arrangement) };
  if (key === 'gap') return { handled: true, error: parseGap(raw, arrangement) };
  return { handled: true, error: parseContainerAlign(raw, arrangement) };
}

export function parseAppearance(
  key: string, raw: string, context: PresentationContext,
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

export function arrangementFailure(
  arrangement: Partial<AuthoredArrangement>,
  context: PresentationContext,
  hasArrangementAttribute: boolean,
): { error: string; hint: string } | undefined {
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
