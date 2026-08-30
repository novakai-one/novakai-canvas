/**
 * The authoring view of the node-appearance vocabulary: one specification table describing
 * each stored attribute to authoring surfaces, a CLI/DSL token in and the exact stored field
 * out, and one canonical field order so storage compares byte-identically. The table pins
 * every described value list to the schema's own field types at compile time; its entry
 * order is the canonical attribute order for help, discovery, parsing, storage, and printing.
 */
import { ICON_NAMES } from '../records/components.ts';
import {
  BACKGROUNDS, BADGES, BORDER_WIDTHS, COMPONENT_PALETTES, FONT_FAMILIES, FONT_SIZES,
  FONT_WEIGHTS, INK_COLORS, NODE_SHAPES, RADII, SPACINGS, TEXT_ALIGNS, VERTICAL_ALIGNS,
  type NodeAppearance,
} from './node-appearance.ts';

/** Any one stored appearance value; every specification's value list draws from this. */
export type StoredAppearanceValue = NonNullable<NodeAppearance[keyof NodeAppearance]>;

interface SpecifiedAttribute<
  JsonKey extends keyof NodeAppearance,
  Omitted extends string | number | undefined,
> {
  readonly jsonKey: JsonKey;
  readonly values: readonly StoredAppearanceValue[];
  /** What an absent stored value means to a reader; undefined when the component owns it. */
  readonly omitted: Omitted;
}

/** Pins one attribute's permitted values to the schema's own field type at compile time. */
function specify<
  JsonKey extends keyof NodeAppearance,
  Omitted extends string | number | undefined,
>(
  jsonKey: JsonKey,
  values: readonly NonNullable<NodeAppearance[JsonKey]>[],
  omitted: Omitted,
): SpecifiedAttribute<JsonKey, Omitted> {
  return { jsonKey, values, omitted };
}

/**
 * The one specification table, keyed by CLI/DSL attribute name. `omitted` may sit outside
 * the storable values on purpose: omitting `icon` means no icon at all, and omitting
 * `shape` means the rectangle storage leaves out.
 */
const SPECIFICATIONS = {
  icon: specify('icon', ICON_NAMES, 'none'),
  font: specify('font', FONT_FAMILIES, 'sans'),
  size: specify('size', FONT_SIZES, 14),
  weight: specify('weight', FONT_WEIGHTS, 400),
  align: specify('align', TEXT_ALIGNS, 'left'),
  'vertical-align': specify('verticalAlign', VERTICAL_ALIGNS, 'top'),
  text: specify('text', INK_COLORS, 'ink'),
  background: specify('background', BACKGROUNDS, 'transparent'),
  shape: specify('shape', NODE_SHAPES, 'rect'),
  'border-color': specify('borderColor', INK_COLORS, 'muted'),
  border: specify('border', BORDER_WIDTHS, 0),
  radius: specify('radius', RADII, 0),
  padding: specify('padding', SPACINGS, 0),
  badge: specify('badge', BADGES, 'default'),
  palette: specify('palette', COMPONENT_PALETTES, undefined),
};

export type AppearanceKey = keyof typeof SPECIFICATIONS;

/** One attribute described to authoring surfaces: CLI help, DSL parsing, inspection controls. */
export interface AppearanceSpecification {
  readonly key: AppearanceKey;
  readonly jsonKey: keyof NodeAppearance;
  readonly values: readonly StoredAppearanceValue[];
  /** What an absent stored value means to a reader; undefined when the component owns it. */
  readonly omitted: string | number | undefined;
}

/** One attribute's specification; total because the key type is the table's own key set. */
export function appearanceSpecification<Key extends AppearanceKey>(
  key: Key,
): (typeof SPECIFICATIONS)[Key] {
  return SPECIFICATIONS[key];
}

export function isAppearanceKey(value: string): value is AppearanceKey {
  return Object.hasOwn(SPECIFICATIONS, value);
}

// The guard only restores the key type Object.entries widens to string; every key passes it.
const ORDERED_SPECIFICATIONS: readonly AppearanceSpecification[] = Object
  .entries(SPECIFICATIONS)
  .flatMap(([key, attribute]) => (isAppearanceKey(key) ? [{ key, ...attribute }] : []));

/** Every specification in canonical order. The table itself stays private and immutable. */
export function appearanceSpecifications(): readonly AppearanceSpecification[] {
  return ORDERED_SPECIFICATIONS;
}

const KEY_BY_JSON_KEY: ReadonlyMap<string, AppearanceKey> = new Map(
  ORDERED_SPECIFICATIONS.map((specification): [string, AppearanceKey] =>
    [specification.jsonKey, specification.key]),
);

export function appearanceKeyForJsonKey(value: string): AppearanceKey | undefined {
  return KEY_BY_JSON_KEY.get(value);
}

/** One stored field a parsed CLI/DSL token represents. */
export interface AppearanceEntry {
  jsonKey: keyof NodeAppearance;
  value: StoredAppearanceValue;
}

/** Parses one closed CLI token to the exact JSON field/value it represents. */
export function appearanceEntry(key: AppearanceKey, raw: string): AppearanceEntry | undefined {
  const specification = appearanceSpecification(key);
  const value = specification.values.find((candidate) => String(candidate) === raw);
  if (value === undefined) return undefined;
  return { jsonKey: specification.jsonKey, value };
}

/** Reorders authored values once so semantically identical DSL compares byte-identically. */
export function canonicalNodeAppearance(input: NodeAppearance): NodeAppearance {
  const result: NodeAppearance = {};
  for (const specification of appearanceSpecifications()) {
    copyStoredField(result, input, specification.jsonKey);
  }
  return result;
}

/** One generic hop so the compiler ties the source and target field types together. */
function copyStoredField<Key extends keyof NodeAppearance>(
  target: NodeAppearance,
  source: NodeAppearance,
  key: Key,
): void {
  const value = source[key];
  if (value !== undefined) target[key] = value;
}
