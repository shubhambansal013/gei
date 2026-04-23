import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildXlsx } from '../xlsx';

describe('buildXlsx', () => {
  it('emits a workbook with frozen header and the expected rows', async () => {
    const buf = await buildXlsx({
      sheetName: 'Stock',
      columns: [
        { key: 'name', header: 'Name' },
        { key: 'qty', header: 'Qty', numFmt: '#,##0.00' },
      ],
      rows: [
        { name: 'Cement', qty: 100 },
        { name: 'Rebar', qty: 50 },
      ],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Stock')!;
    expect(ws.getCell('A1').value).toBe('Name');
    expect(ws.getCell('B2').value).toBe(100);
    const view = ws.views[0];
    expect(view?.state).toBe('frozen');
    // ExcelJS types `ySplit` only on the frozen variant of the discriminated
    // union, so narrow before asserting.
    if (view?.state === 'frozen') {
      expect(view.ySplit).toBe(1);
    }
  });
});
