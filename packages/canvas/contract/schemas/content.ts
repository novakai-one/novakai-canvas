import { z } from 'zod';
import { ICON_NAMES } from '../records/components.ts';
import type { NodeKind } from '../types/node-kind.ts';
import { entityFieldsSchema, entityRefSchema } from './entity.ts';
import { oouxObjectRefSchema, oouxRowsSchema } from './ooux-object.ts';

export const TREE_ROW_KINDS = ['project', 'mission', 'task', 'bucket'] as const;
export const METRIC_STATUSES = ['neutral', 'success', 'warning', 'critical'] as const;
export const CALLOUT_KINDS = ['info', 'warning', 'decision', 'success'] as const;
export const BLOCK_WIRE_REF = /^[a-z][a-z0-9-]{0,63}$/;

const calloutSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(CALLOUT_KINDS),
  text: z.string().min(1),
});

const calloutsSchema = z.array(calloutSchema).superRefine((callouts, context) => {
  const seen = new Set<string>();
  callouts.forEach((callout, index) => {
    if (seen.has(callout.id)) {
      context.addIssue({ code: 'custom', message: `duplicate callout id "${callout.id}"`, path: [index, 'id'] });
    }
    seen.add(callout.id);
  });
});

const CONTENT_FIELDS: Record<NodeKind, Record<string, z.ZodTypeAny>> = {
  group: {}, module: {}, object: {}, runtime: {}, resource: {}, comment: {},
  tree: {
    rows: z.array(z.object({
      id: z.string().min(1),
      kind: z.enum(TREE_ROW_KINDS),
      status: z.string().optional(),
      parentRowId: z.string().optional(),
      badges: z.array(z.string()),
      label: z.string().optional(),
    })).optional(),
  },
  timeline: {
    steps: z.array(z.object({
      id: z.string(), label: z.string(), fork: z.string().optional(),
    })).optional(),
  },
  metric: {
    value: z.string().min(1),
    detail: z.string().min(1).optional(),
    status: z.enum(METRIC_STATUSES).optional(),
  },
  'icon-card': { icon: z.enum(ICON_NAMES), description: z.string().min(1) },
  'callout-stack': { callouts: calloutsSchema.optional() },
  block: {
    lines: z.array(z.string().min(1)).optional(),
    wireRef: z.string().regex(BLOCK_WIRE_REF).optional(),
  },
  'ooux-object': { objectRef: oouxObjectRefSchema, oouxRows: oouxRowsSchema.optional() },
  entity: { entityRef: entityRefSchema, entityFields: entityFieldsSchema.optional() },
};

/** Stored fields owned by one semantic node kind. */
export function nodeContentFields(kind: NodeKind): Record<string, z.ZodTypeAny> {
  return CONTENT_FIELDS[kind];
}
