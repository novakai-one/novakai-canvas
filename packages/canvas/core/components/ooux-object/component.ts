/** Registry-owned OOUX object with ordered attributes and calls to action. */

import type { OouxAttributeRow, OouxCtaRow, OouxRow } from '../../../contract/schemas/ooux-object.ts';
import {
  OOUX_ATTRIBUTE_ROLES, OOUX_ATTRIBUTE_TRAITS, oouxObjectRefSchema, oouxRowsSchema,
} from '../../../contract/schemas/ooux-object.ts';
import type { CanvasNode } from '../../../contract/records/index.ts';
import type {
  ComponentItem, DiagramComponent, DslChildStatement, DslNodeDeclaration,
} from '../component.ts';
import { parseAssignedFields } from '../dsl-fields.ts';

const DECLARATION = 'ooux-object "name" ref=kebab-case';
const DECLARATION_EXAMPLE = 'ooux-object "Organization" ref=organization';
const ATTRIBUTE = 'attribute "name" id=stable-id type=value-type role=core|metadata [traits=filterable,sortable]';
const CTA = 'cta "name" id=stable-id role=role-name';

function printRows(node: CanvasNode): string[] {
  return (node.oouxRows ?? []).map((row) => row.kind === 'attribute'
    ? `  attribute "${row.name}" id=${row.id} type=${row.valueType} role=${row.role}${row.traits.length ? ` traits=${row.traits.join(',')}` : ''}`
    : `  cta "${row.name}" id=${row.id} role=${row.role}`);
}

const declaration: DslNodeDeclaration = {
  syntax: DECLARATION, example: DECLARATION_EXAMPLE, allowsBody: true,
  parse(tokens) {
    const label = tokens[1];
    const parsed = parseAssignedFields(tokens, ['ref'], DECLARATION);
    if (!label || label.includes('=')) return { error: 'ooux-object needs a name', hint: DECLARATION_EXAMPLE };
    if (!parsed.valid) return parsed;
    if (!parsed.fields.ref) return { error: 'ooux-object needs ref=kebab-case', hint: DECLARATION_EXAMPLE };
    if (!oouxObjectRefSchema.safeParse(parsed.fields.ref).success) {
      return { error: `invalid OOUX object ref "${parsed.fields.ref}"`, hint: 'use lowercase kebab-case' };
    }
    return { label, content: { objectRef: parsed.fields.ref } };
  },
  print(node) { return `ooux-object "${node.label}" ref=${node.objectRef}`; },
};

const attributeChild: DslChildStatement = {
  keyword: 'attribute', syntax: ATTRIBUTE,
  example: 'attribute "plan_tier" id=plan-tier type=enum role=metadata traits=filterable,sortable',
  contentKey: 'oouxRows',
  parse(tokens) {
    const name = tokens[1];
    if (!name || name.includes('=')) return { error: 'attribute needs a name', hint: ATTRIBUTE };
    const parsed = parseAssignedFields(tokens, ['id', 'type', 'role', 'traits'], ATTRIBUTE);
    if (!parsed.valid) return parsed;
    const values = parsed.fields;
    if (!values.id || !values.type || !values.role) return { error: 'attribute needs id, type, and role', hint: ATTRIBUTE };
    if (values.type.length > 48) return { error: 'attribute type exceeds 48 characters', hint: ATTRIBUTE };
    if (!OOUX_ATTRIBUTE_ROLES.includes(values.role as OouxAttributeRow['role'])) {
      return { error: `unknown attribute role "${values.role}"`, hint: ATTRIBUTE };
    }
    const traits = (values.traits ? values.traits.split(',') : []) as OouxAttributeRow['traits'];
    const invalid = traits.find((trait) => !OOUX_ATTRIBUTE_TRAITS.includes(trait as OouxAttributeRow['traits'][number]));
    if (invalid) return { error: `unknown attribute trait "${invalid}"`, hint: ATTRIBUTE };
    const duplicate = traits.find((trait, index) => traits.indexOf(trait) !== index);
    if (duplicate) return { error: `duplicate attribute trait "${duplicate}"`, hint: ATTRIBUTE };
    return { content: {
      kind: 'attribute', id: values.id, name, valueType: values.type,
      role: values.role as OouxAttributeRow['role'], traits,
    } satisfies OouxAttributeRow };
  },
  validate(content, siblings) {
    const row = content as OouxRow;
    return siblings.some((sibling) => (sibling as OouxRow).id === row.id)
      ? { error: `duplicate OOUX row id "${row.id}"`, hint: ATTRIBUTE } : undefined;
  },
  print: printRows,
};

const ctaChild: DslChildStatement = {
  keyword: 'cta', syntax: CTA, example: 'cta "inviteMember" id=invite-member role=admin',
  contentKey: 'oouxRows',
  parse(tokens) {
    const name = tokens[1];
    if (!name || name.includes('=')) return { error: 'cta needs a name', hint: CTA };
    const parsed = parseAssignedFields(tokens, ['id', 'role'], CTA);
    if (!parsed.valid) return parsed;
    if (!parsed.fields.id || !parsed.fields.role) return { error: 'cta needs id and role', hint: CTA };
    if (parsed.fields.role.length > 64) return { error: 'cta role exceeds 64 characters', hint: CTA };
    return { content: {
      kind: 'cta', id: parsed.fields.id, name, role: parsed.fields.role,
    } satisfies OouxCtaRow };
  },
  validate(content, siblings) {
    const row = content as OouxRow;
    return siblings.some((sibling) => (sibling as OouxRow).id === row.id)
      ? { error: `duplicate OOUX row id "${row.id}"`, hint: CTA } : undefined;
  },
  print() { return []; },
};

function item(row: OouxRow): ComponentItem {
  return {
    collection: 'oouxRows', id: row.id, kind: row.kind, label: row.name,
    fields: row.kind === 'attribute'
      ? [
        { label: 'ID', value: row.id }, { label: 'Type', value: row.valueType },
        { label: 'Role', value: row.role }, { label: 'Traits', value: row.traits.join(', ') || 'None' },
      ]
      : [{ label: 'ID', value: row.id }, { label: 'Role', value: row.role }],
  };
}

function esc(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export const oouxObjectComponent: DiagramComponent<'ooux-object'> = {
  kind: 'ooux-object', dslKeyword: 'ooux-object', declaration,
  creation: {
    category: 'shape', label: 'OOUX object', hint: 'Attributes and calls to action',
    defaultLabel: 'New object', initialSize: { width: 340, height: 220 },
    initialSizeMode: 'manual', stableIdField: 'objectRef',
  },
  resize: { minSize: { width: 260, height: 120 } },
  layoutRole: 'leaf', allowsMembers: false,
  identity: {
    scope: 'parent', namespace: 'ooux-object', keyField: 'objectRef',
    wireAddress: { field: 'objectRef' }, preserveDeclarationOrder: true,
  },
  contentFields: { objectRef: oouxObjectRefSchema, oouxRows: oouxRowsSchema.optional() },
  contentEditors: [{
    field: 'oouxRows', kind: 'record-list', label: 'Object rows', itemLabel: 'Row',
    identity: { field: 'id', prefix: 'row' }, discriminator: 'kind',
    variants: [
      {
        key: 'attribute', label: 'Attribute',
        defaults: { name: '', valueType: 'string', role: 'core', traits: [] },
        fields: [
          { field: 'name', label: 'Name', control: 'text', required: true },
          { field: 'valueType', label: 'Type', control: 'text', required: true, maxLength: 48 },
          { field: 'role', label: 'Role', control: 'select', required: true, values: OOUX_ATTRIBUTE_ROLES },
          { field: 'traits', label: 'Traits', control: 'multi-select', values: OOUX_ATTRIBUTE_TRAITS },
        ],
      },
      {
        key: 'cta', label: 'CTA', defaults: { name: '', role: 'admin' },
        fields: [
          { field: 'name', label: 'Name', control: 'text', required: true },
          { field: 'role', label: 'Role', control: 'text', required: true, maxLength: 64 },
        ],
      },
    ],
  }],
  dslChildren: [attributeChild, ctaChild],
  appearanceKeys: ['palette'],
  items(node) { return (node.oouxRows ?? []).map(item); },
  measure(node) {
    const longest = Math.max(node.label.length, ...(node.oouxRows ?? []).map((row) => row.name.length));
    return { width: Math.min(460, Math.max(300, 170 + longest * 6)), height: 62 + (node.oouxRows?.length ?? 0) * 32 };
  },
  renderSvg(node, box, appearance) {
    const colors = appearance.paletteColors;
    if (!colors) return '';
    const parts = [
      `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${colors.surface}" stroke="${colors.frame}" stroke-width="2" rx="8"/>`,
      `<path d="M${box.x},${box.y + 50}H${box.x + box.width}" stroke="${colors.frame}" stroke-width="2"/>`,
      `<rect x="${box.x + 1}" y="${box.y + 1}" width="${box.width - 2}" height="48" fill="${colors.header}" rx="7"/>`,
      `<text x="${box.x + box.width / 2}" y="${box.y + 23}" text-anchor="middle" fill="${colors.headerText}" font-family="Inter,sans-serif" font-size="15" font-weight="700">${esc(node.label.toUpperCase())}</text>`,
      `<text x="${box.x + box.width / 2}" y="${box.y + 40}" text-anchor="middle" fill="${colors.headerMuted}" font-family="Inter,sans-serif" font-size="9">«object»</text>`,
    ];
    (node.oouxRows ?? []).forEach((row, index) => {
      const y = box.y + 60 + index * 32;
      const fill = row.kind === 'cta' ? colors.action
        : row.role === 'core' ? colors.core : colors.metadata;
      const suffix = row.kind === 'cta' ? `@${row.role}` : row.traits.join(' · ') || row.role;
      const main = row.kind === 'cta' ? `ƒ  ${row.name}()` : `${row.name} : ${row.valueType}`;
      parts.push(`<rect x="${box.x + 10}" y="${y}" width="${box.width - 20}" height="25" fill="${fill}"/>`);
      parts.push(`<text x="${box.x + 18}" y="${y + 17}" fill="${colors.text}" font-family="Inter,sans-serif" font-size="11">${esc(main)}</text>`);
      parts.push(`<text x="${box.x + box.width - 18}" y="${y + 17}" text-anchor="end" fill="${colors.muted}" font-family="Inter,sans-serif" font-size="9" font-style="italic">${esc(suffix)}</text>`);
    });
    return parts.join('\n');
  },
};
