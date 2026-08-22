/** One canonical CLI adapter for wire attribute parsing, printing and discovery. */

import {
  WIRE_APPEARANCE_SPECIFICATIONS, canonicalWireAppearance, type WireAppearance,
} from '../../src/domain/wire-appearance.ts';
import {
  WIRE_CARDINALITIES, type WireCardinality,
} from '../../src/domain/wire-cardinality.ts';

export interface AuthoredWireAttributes {
  sourceCardinality?: WireCardinality;
  targetCardinality?: WireCardinality;
  appearance?: WireAppearance;
}

const CARDINALITY_ATTRIBUTES = [
  { key: 'source-cardinality', field: 'sourceCardinality' },
  { key: 'target-cardinality', field: 'targetCardinality' },
] as const;

export type WireAttributeParseResult =
  | { valid: true; value: AuthoredWireAttributes }
  | { valid: false; error: string; hint: string };

/** Human-readable optional grammar in canonical attribute order. */
export function wireAttributeHelp(): string {
  return [
    ...CARDINALITY_ATTRIBUTES.map((entry) => `[${entry.key}=${WIRE_CARDINALITIES.join('|')}]`),
    ...WIRE_APPEARANCE_SPECIFICATIONS
      .map((entry) => `[${entry.key}=${entry.values.join('|')}]`),
  ].join(' ');
}

/** Parses all wire attributes or returns the existing exact correction. */
export function parseWireAttributes(tokens: string[]): WireAttributeParseResult {
  const appearance: WireAppearance = {};
  const cardinality: Partial<AuthoredWireAttributes> = {};
  const seen = new Set<string>();
  const correction = [
    ...CARDINALITY_ATTRIBUTES.map((entry) => `${entry.key}=${WIRE_CARDINALITIES.join('|')}`),
    ...WIRE_APPEARANCE_SPECIFICATIONS.map((entry) => `${entry.key}=${entry.values.join('|')}`),
  ].join(' ');
  for (const token of tokens) {
    const equals = token.indexOf('=');
    const rawKey = token.slice(0, Math.max(0, equals));
    const cardinalitySpec = CARDINALITY_ATTRIBUTES.find((entry) => entry.key === rawKey);
    const key = rawKey as keyof WireAppearance;
    const specification = WIRE_APPEARANCE_SPECIFICATIONS.find((entry) => entry.key === key);
    if (equals < 1 || (!specification && !cardinalitySpec)) {
      return {
        valid: false,
        error: `unknown wire attribute "${equals < 1 ? token : rawKey}"`,
        hint: `use ${correction}`,
      };
    }
    if (seen.has(rawKey)) {
      return {
        valid: false, error: `duplicate wire attribute "${rawKey}"`,
        hint: `write ${rawKey}= once`,
      };
    }
    seen.add(rawKey);
    const raw = token.slice(equals + 1);
    if (cardinalitySpec) {
      if (!WIRE_CARDINALITIES.some((value) => value === raw)) {
        return {
          valid: false, error: `invalid wire ${rawKey} "${raw}"`,
          hint: `use one of: ${WIRE_CARDINALITIES.join(', ')}`,
        };
      }
      cardinality[cardinalitySpec.field] = raw as WireCardinality;
      continue;
    }
    if (!specification) continue;
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
    value: {
      ...cardinality,
      ...(Object.keys(canonical).length > 0 ? { appearance: canonical } : {}),
    },
  };
}

/** Prints canonical attributes; omitted values remain absent. */
export function printWireAttributes(attributes: AuthoredWireAttributes): string[] {
  const appearance = attributes.appearance;
  return [
    ...CARDINALITY_ATTRIBUTES.flatMap((entry) => {
      const value = attributes[entry.field];
      return value === undefined ? [] : [`${entry.key}=${value}`];
    }),
    ...WIRE_APPEARANCE_SPECIFICATIONS.flatMap((entry) => {
      const value = appearance?.[entry.key];
      return value === undefined ? [] : [`${entry.key}=${value}`];
    }),
  ];
}
