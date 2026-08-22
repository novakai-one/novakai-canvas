import { z } from 'zod';

export const OOUX_ATTRIBUTE_ROLES = ['core', 'metadata'] as const;
export const OOUX_ATTRIBUTE_TRAITS = ['filterable', 'sortable'] as const;
export const OOUX_OBJECT_REF_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export type OouxAttributeRole = typeof OOUX_ATTRIBUTE_ROLES[number];
export type OouxAttributeTrait = typeof OOUX_ATTRIBUTE_TRAITS[number];

export interface OouxAttributeRow {
  kind: 'attribute'; id: string; name: string; valueType: string;
  role: OouxAttributeRole; traits: OouxAttributeTrait[];
}

export interface OouxCtaRow {
  kind: 'cta'; id: string; name: string; role: string;
}

export type OouxRow = OouxAttributeRow | OouxCtaRow;

export const oouxObjectRefSchema = z.string().min(1).max(64).regex(OOUX_OBJECT_REF_PATTERN);

const attributeTraitsSchema = z.array(z.enum(OOUX_ATTRIBUTE_TRAITS)).superRefine((traits, context) => {
  const duplicate = traits.find((trait, index) => traits.indexOf(trait) !== index);
  if (duplicate) context.addIssue({ code: 'custom', message: `duplicate OOUX trait "${duplicate}"` });
});

const attributeRowSchema = z.object({
  kind: z.literal('attribute'), id: z.string().min(1), name: z.string().min(1),
  valueType: z.string().min(1).max(48), role: z.enum(OOUX_ATTRIBUTE_ROLES),
  traits: attributeTraitsSchema,
}).strict();

const ctaRowSchema = z.object({
  kind: z.literal('cta'), id: z.string().min(1), name: z.string().min(1),
  role: z.string().min(1).max(64),
}).strict();

export const oouxRowsSchema = z.array(z.discriminatedUnion('kind', [
  attributeRowSchema, ctaRowSchema,
])).superRefine((rows, context) => {
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    if (seen.has(row.id)) {
      context.addIssue({ code: 'custom', message: `duplicate OOUX row id "${row.id}"`, path: [index, 'id'] });
    }
    seen.add(row.id);
  });
});
