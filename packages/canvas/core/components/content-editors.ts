/**
 * Host-neutral declarations of the semantic content editors a registered component may expose.
 * Hosts render these declaratively; the component owns which fields exist and how a collection
 * is addressed — by stored identity (`record-list`) or purely by position (`item-list`).
 */

/** Host-neutral declaration of a semantic string collection a person may edit. */
export interface StringListContentEditorDeclaration {
  field: string;
  kind: 'string-list';
  label: string;
  itemLabel: string;
}

/** One required or optional text field in a structured content row. */
export interface RecordEditorTextField {
  field: string;
  label: string;
  control: 'text';
  required?: boolean;
  maxLength?: number;
}

/** One closed single-value field in a structured content row. */
export interface RecordEditorSelectField {
  field: string;
  label: string;
  control: 'select';
  values: readonly string[];
  required?: boolean;
}

/** One closed set-valued field in a structured content row. */
export interface RecordEditorMultiSelectField {
  field: string;
  label: string;
  control: 'multi-select';
  values: readonly string[];
}

export type RecordEditorField =
  | RecordEditorTextField | RecordEditorSelectField | RecordEditorMultiSelectField;

/** One valid row variant and the fields that become editable when selected. */
export interface RecordEditorVariant {
  key: string;
  label: string;
  defaults: Readonly<Record<string, unknown>>;
  fields: readonly RecordEditorField[];
}

/** Host-neutral declaration of an ordered structured collection. */
export interface RecordListContentEditorDeclaration {
  field: string;
  kind: 'record-list';
  label: string;
  itemLabel: string;
  identity: { field: string; prefix: string };
  discriminator?: string;
  variants: readonly [RecordEditorVariant, ...RecordEditorVariant[]];
}

/**
 * Host-neutral declaration of a short ordered collection addressed by position. Items carry no
 * stored identity, so hosts must key rows by index and never mint ids into the record.
 */
export interface ItemListContentEditorDeclaration {
  field: string;
  kind: 'item-list';
  label: string;
  itemLabel: string;
  fields: readonly RecordEditorField[];
  /** A new item's starting values. */
  defaults: Readonly<Record<string, unknown>>;
  maxItems: number;
}

/** Every semantic editor a registered component can expose to a host. */
export type ContentEditorDeclaration =
  | StringListContentEditorDeclaration
  | RecordListContentEditorDeclaration
  | ItemListContentEditorDeclaration;
