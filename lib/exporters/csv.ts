export type CsvColumn<T> = { key: keyof T; header: string };
export type CsvInput<T> = { columns: CsvColumn<T>[]; rows: T[] };

const NEEDS_QUOTE = /[",\n\r]/;

function escape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return NEEDS_QUOTE.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Produces a UTF-8-BOM-prefixed CSV string. The BOM makes Excel on Windows
 * detect UTF-8 correctly without a user prompt. Use `downloadCSV` to send
 * it to the browser.
 */
export function toCSV<T>({ columns, rows }: CsvInput<T>): string {
  const BOM = '\uFEFF';
  const head = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escape(r[c.key])).join(',')).join('\n');
  return `${BOM}${head}\n${body}`;
}

export function downloadCSV<T>(filename: string, input: CsvInput<T>) {
  const blob = new Blob([toCSV(input)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
