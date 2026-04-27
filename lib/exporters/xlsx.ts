export type XlsxColumn<T> = {
  key: keyof T;
  header: string;
  width?: number;
  numFmt?: string;
};

export type XlsxInput<T> = {
  sheetName: string;
  columns: XlsxColumn<T>[];
  rows: T[];
};

/**
 * Builds an XLSX buffer with: frozen header row, bold headers,
 * auto-filter on header, auto-width (from column.width or content).
 * Pass the buffer straight to a Blob for download.
 */
export async function buildXlsx<T>({
  sheetName,
  columns,
  rows,
}: XlsxInput<T>): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  ws.columns = columns.map((c) => ({
    header: c.header,
    key: String(c.key),
    width: c.width ?? Math.max(12, c.header.length + 2),
    style: c.numFmt ? { numFmt: c.numFmt } : {},
  }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  rows.forEach((r) => ws.addRow(r));

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

export async function downloadXlsx<T>(filename: string, input: XlsxInput<T>) {
  const buf = await buildXlsx(input);
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
