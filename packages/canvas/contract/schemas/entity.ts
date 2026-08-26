import { z } from 'zod';

/** Closed relationship-key markers shown in an Entity's third column. */
export const ENTITY_KEYS = ['pk', 'fk', 'uk'] as const;

export type EntityKey = (typeof ENTITY_KEYS)[number];

/** One stable ordered field inside an Entity shape. */
export interface EntityField {
  id: string;
  name: string;
  valueType: string;
  keys: EntityKey[];
}

const entityKeySchema = z.enum(ENTITY_KEYS);

/** Stable agent-facing identity for an Entity occurrence. */
export const entityRefSchema = z.string().min(1).max(64)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);

const entityFieldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  valueType: z.string().min(1).max(48),
  keys: z.array(entityKeySchema).superRefine((keys, context) => {
    const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
    if (duplicate) context.addIssue({ code: 'custom', message: `duplicate Entity key "${duplicate}"` });
  }),
}).strict();

/** Strict ordered field collection with identity unique inside one Entity. */
export const entityFieldsSchema = z.array(entityFieldSchema).superRefine((fields, context) => {
  const seen = new Set<string>();
  fields.forEach((field, index) => {
    if (seen.has(field.id)) {
      context.addIssue({
        code: 'custom', message: `duplicate Entity field id "${field.id}"`, path: [index, 'id'],
      });
    }
    seen.add(field.id);
  });
});
