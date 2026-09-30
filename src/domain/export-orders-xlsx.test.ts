import {describe, expect, it} from 'vitest';
import {buildOrderWorkbookSheets, createOrderWorkbookBlob} from './export-orders-xlsx';
import {unzipSync, strFromU8} from 'fflate';
import type {Order, ShopSettings} from '../types';

const settings: ShopSettings = {
  shopNameEn: 'Test Store',
  shopNameZh: '测试店',
  coverPhoto: '',
  qrImage: null,
  menuItems: [{
    id: 'meal-1',
    name: {en: '=Unsafe-looking meal', zh: '测试餐'},
    basePrice: 8,
    image: '',
    sizes: [],
    noodleBases: [],
    addOns: [],
  }],
  enableTax: false,
  taxRate: 6,
  takeawayFee: 0.5,
};

const order: Order = {
  local_order_id: 'order-uid-1',
  order_id: '90001',
  timestamp: '2026-09-01 10:30:00',
  order_type: 'Dine-in',
  table_no: '@Table 1',
  items_summary: '=SUM(A1:A2)',
  items: [{
    id: 'line-1',
    menuItemId: 'meal-1',
    sizeId: 'regular',
    noodleBaseIds: [],
    addOnIds: [],
    optionSelections: [{
      optionGroupId: 'protein',
      groupNames: {en: 'Protein', zh: '肉类'},
      choiceId: 'beef',
      choiceNames: {en: '+Beef', zh: '牛肉'},
      priceDeltaSen: 200,
    }],
    quantity: 2,
    unitPrice: 10,
    totalPrice: 20,
  }],
  total_qty: 2,
  subtotal: 20,
  takeaway_fee: 0,
  tax_amount: 0,
  total_amount: 20,
  status: 'Completed',
  paid: true,
  payment_method: 'Cash',
  synced: false,
};

describe('buildOrderWorkbookSheets', () => {
  it('creates four report sheets with numeric money cells and a receipt summary', () => {
    const sheets = buildOrderWorkbookSheets([order], settings);

    expect(sheets.map(sheet => sheet.sheet)).toEqual(['Summary', 'Daily', 'Orders', 'Order Items']);
    expect(sheets[2].data).toHaveLength(2);
    expect(sheets[3].data).toHaveLength(2);
    expect(sheets[2].data[1][10]).toMatchObject({value: 20, type: Number, format: '0.00'});
    expect(sheets[0].data[4][1]).toMatchObject({value: 20, type: Number});
  });

  it('writes merchant-controlled spreadsheet values explicitly as text', () => {
    const sheets = buildOrderWorkbookSheets([order], settings);

    expect(sheets[2].data[1][4]).toMatchObject({value: '@Table 1', type: String});
    expect(sheets[2].data[1][5]).toMatchObject({value: '=Unsafe-looking meal × 2', type: String});
    expect(sheets[3].data[1][3]).toMatchObject({value: '=Unsafe-looking meal', type: String});
    expect(sheets[3].data[1][5]).toMatchObject({value: 'Protein: +Beef', type: String});
  });

  it.each(['=formula', '+formula', '-formula', '@formula', '\tformula', '\rformula'])(
    'keeps formula-like workbook text typed as String: %j',
    (value) => {
      const formulaLookingOrder = {...order, table_no: value};
      const sheets = buildOrderWorkbookSheets([formulaLookingOrder], settings);

      expect(sheets[2].data[1][4]).toMatchObject({value, type: String});
    },
  );

  it('creates a valid XLSX ZIP with four sheets and correct cross-day receipts', async () => {
    const paidLater = {...order, paid_at: '2026-10-01T01:00:00Z'};
    const blob = await createOrderWorkbookBlob([paidLater], settings, {from: '2026-10-01', to: '2026-10-01'});
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const workbook = strFromU8(files['xl/workbook.xml']);
    expect(workbook).toContain('name="Summary"');
    expect(workbook).toContain('name="Daily"');
    expect(workbook).toContain('name="Orders"');
    expect(workbook).toContain('name="Order Items"');
    expect(strFromU8(files['xl/worksheets/sheet1.xml'])).toMatch(/<c[^>]*r="B5"[^>]*><v>20<\/v><\/c>/);
  });
});
