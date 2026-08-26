export type MarkdownRow = readonly string[];

function cell(value: string | undefined): string {
  if (!value) return '—';
  return value.replaceAll('|', '\\|').replaceAll(/\r?\n/g, '<br>');
}

export function table(headers: readonly string[], rows: readonly MarkdownRow[]): string[] {
  if (rows.length === 0) return [];
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
}
