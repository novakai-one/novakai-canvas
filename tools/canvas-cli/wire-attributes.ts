/** One canonical CLI adapter for wire attribute parsing, printing and discovery. */

import {
  WIRE_APPEARANCE_SPECIFICATIONS, canonicalWireAppearance, type WireAppearance,
} from '../../src/domain/wire-appearance.ts';

export interface AuthoredWireAttributes { appearance?: WireAppearance }

export type WireAttributeParseResult =
  | { valid: true; value: AuthoredWireAttributes }
  | { valid: false; error: string; hint: string };

/** Human-readable optional grammar in canonical attribute order. */
export function wireAttributeHelp(): string {
  return WIRE_APPEARANCE_SPECIFICATIONS
    .map((entry) => `[${entry.key}=${entry.values.join('|')}]`).join(' ');
}

/** Parses all wire attributes or returns the existing exact correction. */
export function parseWireAttributes(tokens: string[]): WireAttributeParseResult {
  const appearance: WireAppearance = {};
  const seen = new Set<string>();
  const correction = WIRE_APPEARANCE_SPECIFICATIONS
    .map((entry) => `${entry.key}=${entry.values.join('|')}`).join(' ');
  for (const token of tokens) {
    const equals = token.indexOf('=');
    const key = token.slice(0, Math.max(0, equals)) as keyof WireAppearance;
    const specification = WIRE_APPEARANCE_SPECIFICATIONS.find((entry) => entry.key === key);
    if (equals < 1 || !specification) {
      return {
        valid: false,
        error: `unknown wire attribute "${equals < 1 ? token : key}"`,
        hint: `use ${correction}`,
      };
    }
    if (seen.has(key)) {
      return { valid: false, error: `duplicate wire attribute "${key}"`, hint: `write ${key}= once` };
    }
    seen.add(key);
    const raw = token.slice(equals + 1);
    if (!specification.values.some((value) => value === raw)) {
      return {
        valid: false,
        error: `invalid wire ${key} "${raw}"`,
        hint: `use one of: ${specification.values.join(', ')}`,
      };
    }
    (appearance as Record<string, unknown>)[key] = raw;
  }
  const canonical = canonicalWireAppearance(appearance);
  return {
    valid: true,
    value: Object.keys(canonical).length > 0 ? { appearance: canonical } : {},
  };
}

/** Prints canonical attributes; omitted values remain absent. */
export function printWireAttributes(attributes: AuthoredWireAttributes): string[] {
  const appearance = attributes.appearance;
  if (!appearance) return [];
  return WIRE_APPEARANCE_SPECIFICATIONS.flatMap((entry) => {
    const value = appearance[entry.key];
    return value === undefined ? [] : [`${entry.key}=${value}`];
  });
}
