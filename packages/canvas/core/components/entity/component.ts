/** Registry-owned ERD Entity with fixed Type, Field and Keys columns. */

import type {
  ComponentItem, DiagramComponent, DslChildStatement, DslNodeDeclaration,
} from '../component.ts';
import { parseAssignedFields } from '../dsl-fields.ts';
import {
  ENTITY_KEYS, entityFieldsSchema, entityRefSchema, type EntityField, type EntityKey,
} from '../../../contract/schemas/entity.ts';
import type { CanvasNode } from '../../../contract/records/index.ts';

const DECLARATION = 'entity "name" ref=kebab-case [palette=neutral|blue|violet|sage]';
const EXAMPLE = 'entity "PROVIDER_SESSION" ref=provider-session palette=violet';
const FIELD = 'field "name" id=stable-id type=value-type [keys=pk,fk,uk]';

function canonicalKeys(raw: string | undefined): EntityKey[] | { error: string; hint: string } {
  if (!raw) return [];
  const authored = raw.split(',');
  const unknown = authored.find((key) => !ENTITY_KEYS.includes(key as EntityKey));
  if (unknown) return { error: `unknown Entity key "${unknown}"`, hint: FIELD };
  const duplicate = authored.find((key, index) => authored.indexOf(key) !== index);
  if (duplicate) return { error: `duplicate Entity key "${duplicate}"`, hint: FIELD };
  return ENTITY_KEYS.filter((key) => authored.includes(key));
}

function printFields(node: CanvasNode): string[] {
  return (node.entityFields ?? []).map((field) =>
    `  field "${field.name}" id=${field.id} type=${field.valueType}`
      + `${field.keys.length ? ` keys=${ENTITY_KEYS.filter((key) => field.keys.includes(key)).join(',')}` : ''}`);
}

const declaration: DslNodeDeclaration = {
  syntax: DECLARATION, example: EXAMPLE, allowsBody: true,
  parse(tokens) {
    const label = tokens[1];
    const parsed = parseAssignedFields(tokens, ['ref'], DECLARATION);
    if (!label || label.includes('=')) return { error: 'entity needs a name', hint: EXAMPLE };
    if (!parsed.valid) return parsed;
    if (!parsed.fields.ref) return { error: 'entity needs ref=kebab-case', hint: EXAMPLE };
    if (!entityRefSchema.safeParse(parsed.fields.ref).success) {
      return { error: `invalid Entity ref "${parsed.fields.ref}"`, hint: 'use lowercase kebab-case' };
    }
    return { label, content: { entityRef: parsed.fields.ref } };
  },
  print(node) { return `entity "${node.label}" ref=${node.entityRef}`; },
};

const fieldChild: DslChildStatement = {
  keyword: 'field', syntax: FIELD,
  example: 'field "providerSessionId" id=provider-session-id type=string keys=pk,fk',
  contentKey: 'entityFields',
  parse(tokens) {
    const name = tokens[1];
    if (!name || name.includes('=')) return { error: 'field needs a name', hint: FIELD };
    const parsed = parseAssignedFields(tokens, ['id', 'type', 'keys'], FIELD);
    if (!parsed.valid) return parsed;
    if (!parsed.fields.id || !parsed.fields.type) return { error: 'field needs id and type', hint: FIELD };
    if (parsed.fields.type.length > 48) return { error: 'field type exceeds 48 characters', hint: FIELD };
    const keys = canonicalKeys(parsed.fields.keys);
    if (!Array.isArray(keys)) return keys;
    return { content: {
      id: parsed.fields.id, name, valueType: parsed.fields.type, keys,
    } satisfies EntityField };
  },
  validate(content, siblings) {
    const field = content as EntityField;
    return siblings.some((sibling) => (sibling as EntityField).id === field.id)
      ? { error: `duplicate Entity field id "${field.id}"`, hint: FIELD } : undefined;
  },
  print: printFields,
};

function item(field: EntityField): ComponentItem {
  return {
    collection: 'entityFields', id: field.id, kind: 'entity field', label: field.name,
    fields: [
      { label: 'ID', value: field.id },
      { label: 'Type', value: field.valueType },
      { label: 'Keys', value: field.keys.map((key) => key.toUpperCase()).join(', ') || 'None' },
    ],
  };
}

function esc(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export const entityComponent: DiagramComponent<'entity'> = {
  kind: 'entity', dslKeyword: 'entity', declaration,
  creation: {
    category: 'shape', label: 'Entity', hint: 'Typed fields and relationship keys',
    defaultLabel: 'New entity', initialSize: { width: 380, height: 220 },
    initialSizeMode: 'manual', stableIdField: 'entityRef',
  },
  resize: { minSize: { width: 280, height: 120 } },
  layoutRole: 'leaf', allowsMembers: false,
  identity: {
    scope: 'parent', namespace: 'entity', keyField: 'entityRef',
    wireAddress: { field: 'entityRef' }, preserveDeclarationOrder: true,
  },
  appearanceKeys: ['palette'],
  contentFields: { entityRef: entityRefSchema, entityFields: entityFieldsSchema.optional() },
  contentEditors: [{
    field: 'entityFields', kind: 'record-list', label: 'Fields', itemLabel: 'Field',
    identity: { field: 'id', prefix: 'field' },
    variants: [{
      key: 'field', label: 'Field', defaults: { name: '', valueType: 'string', keys: [] },
      fields: [
        { field: 'valueType', label: 'Type', control: 'text', required: true, maxLength: 48 },
        { field: 'name', label: 'Field', control: 'text', required: true },
        { field: 'keys', label: 'Keys', control: 'multi-select', values: ENTITY_KEYS },
      ],
    }],
  }],
  dslChildren: [fieldChild],
  items(node) { return (node.entityFields ?? []).map(item); },
  measure(node) {
    const fields = node.entityFields ?? [];
    const longest = Math.max(node.label.length, ...fields.map((field) =>
      field.name.length + field.valueType.length + field.keys.join(',').length));
    return { width: Math.min(540, Math.max(320, 180 + longest * 5)), height: 82 + fields.length * 32 };
  },
  renderSvg(node, box, appearance) {
    const colors = appearance.paletteColors;
    if (!colors) return '';
    const headerBottom = box.y + 50;
    const labelsBottom = headerBottom + 24;
    const typeX = box.x + box.width * 0.27;
    const keysX = box.x + box.width * 0.79;
    const parts = [
      `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${colors.surface}" stroke="${colors.frame}" stroke-width="2" rx="7"/>`,
      `<path d="M${box.x},${headerBottom}H${box.x + box.width}" stroke="${colors.frame}"/>`,
      `<rect x="${box.x + 1}" y="${box.y + 1}" width="${box.width - 2}" height="48" fill="${colors.header}" rx="6"/>`,
      `<text x="${box.x + box.width / 2}" y="${box.y + 22}" text-anchor="middle" fill="${colors.headerText}" font-family="Inter,sans-serif" font-size="15" font-weight="700">${esc(node.label.toUpperCase())}</text>`,
      `<text x="${box.x + box.width / 2}" y="${box.y + 39}" text-anchor="middle" fill="${colors.headerMuted}" font-family="Inter,sans-serif" font-size="9">«entity»</text>`,
      `<text x="${box.x + 12}" y="${headerBottom + 16}" fill="${colors.muted}" font-family="Inter,sans-serif" font-size="8" font-weight="700">TYPE</text>`,
      `<text x="${typeX + 10}" y="${headerBottom + 16}" fill="${colors.muted}" font-family="Inter,sans-serif" font-size="8" font-weight="700">FIELD</text>`,
      `<text x="${keysX + 10}" y="${headerBottom + 16}" fill="${colors.muted}" font-family="Inter,sans-serif" font-size="8" font-weight="700">KEYS</text>`,
      `<path d="M${box.x},${labelsBottom}H${box.x + box.width}" stroke="${colors.frame}" stroke-opacity=".45"/>`,
    ];
    (node.entityFields ?? []).forEach((field, index) => {
      const y = labelsBottom + index * 32;
      parts.push(`<rect x="${box.x + 1}" y="${y}" width="${box.width - 2}" height="31" fill="${colors.core}"/>`);
      parts.push(`<path d="M${typeX},${y}V${y + 32}M${keysX},${y}V${y + 32}" stroke="${colors.frame}" stroke-opacity=".35"/>`);
      parts.push(`<text x="${box.x + 12}" y="${y + 21}" fill="${colors.text}" font-family="SFMono-Regular,Consolas,monospace" font-size="10">${esc(field.valueType)}</text>`);
      parts.push(`<text x="${typeX + 10}" y="${y + 21}" fill="${colors.text}" font-family="Inter,sans-serif" font-size="11">${esc(field.name)}</text>`);
      parts.push(`<text x="${keysX + 10}" y="${y + 21}" fill="${colors.muted}" font-family="SFMono-Regular,Consolas,monospace" font-size="9">${esc(field.keys.map((key) => key.toUpperCase()).join(' · '))}</text>`);
    });
    return parts.join('\n');
  },
};
