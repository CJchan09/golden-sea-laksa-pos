import type {CellObject, SheetData} from 'write-excel-file/browser';
import type {Language, Order, ShopSettings} from '../types';
import {localized, orderStatusLabel, orderTypeLabel, paymentLabel, tr} from '../i18n';
import {buildSalesReport, inReportRange, receiptDate, reportingDate, type ReportRange} from './reporting';
import {isSalesOrder} from './sales';
import {saveFile, XLSX_MIME, type SaveFileOptions, type FileSaveResult} from './native-export';

const textCell = (value: unknown): CellObject => ({value: value == null ? '' : String(value), type: String, wrap: true, alignVertical: 'top'});
const numberCell = (value: number): CellObject => ({value: Number.isFinite(value) ? value : 0, type: Number, format: '0.00', align: 'right'});
const integerCell = (value: number): CellObject => ({value, type: Number, align: 'right'});
const headerCell = (value: string): CellObject => ({...textCell(value), fontWeight: 'bold', backgroundColor: '#7A1020', textColor: '#FFD43B'});
export interface OrderWorkbookSheet {data: SheetData; sheet: string; columns: {width?: number}[]; stickyRowsCount: number; orientation?: 'landscape'}
function inferRange(orders: Order[]): ReportRange {
  const dates = orders.flatMap(order => [reportingDate(order.timestamp), receiptDate(order)]).filter(Boolean).sort();
  return {from: dates[0] || reportingDate(), to: dates[dates.length - 1] || reportingDate()};
}
export function buildOrderWorkbookSheets(allOrders: Order[], settings: ShopSettings, range = inferRange(allOrders), language: Language = 'en'): OrderWorkbookSheet[] {
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const report = buildSalesReport(allOrders, range);
  const yes = t('Yes', '是', 'Ya'), no = t('No', '否', 'Tidak');
  const recognized = (order: Order) => isSalesOrder(order) && inReportRange(receiptDate(order), range);
  const unknownTime = t('Legacy: receipt time unknown; assigned to order date', '旧记录：收款时间未知，按下单日归属', 'Rekod lama: masa terimaan tidak diketahui; guna tarikh pesanan');
  const headings = [t('Order No.', '订单号', 'No. pesanan'), 'UID', t('Ordered at', '下单时间', 'Masa pesanan'), t('Order Type', '订单类型', 'Jenis pesanan'), t('Table', '桌号', 'Meja'), t('Items Summary', '商品摘要', 'Ringkasan item'),
    t('Quantity', '件数', 'Kuantiti'), t('Subtotal (RM)', '小计 (RM)', 'Subtotal (RM)'), t('Takeaway Fee (RM)', '打包费 (RM)', 'Caj bungkus (RM)'), t('Tax (RM)', '税 (RM)', 'Cukai (RM)'), t('Total (RM)', '总额 (RM)', 'Jumlah (RM)'),
    t('Status', '状态', 'Status'), t('Paid', '已付款', 'Dibayar'), t('Payment Method', '付款方式', 'Cara bayaran'), t('Cloud Synced', '云端已同步', 'Disegerakkan'),
    t('Received at', '收款时间', 'Masa terimaan'), t('Receipt date', '收款归属日期', 'Tarikh terimaan'), t('Receipts in this period (RM)', '本期间实收 (RM)', 'Terimaan tempoh ini (RM)'), t('Notes', '备注', 'Nota')];
  const orderRows: SheetData = [headings.map(headerCell), ...report.orders.map(order => [
    textCell(order.order_id), textCell(order.local_order_id), textCell(order.timestamp), textCell(orderTypeLabel(language, order.order_type)), textCell(order.table_no), textCell(order.items.length ? order.items.map(item => (localized(item.itemName, language) || localized(settings.menuItems.find(menu => menu.id === item.menuItemId)?.name, language) || item.menuItemId) + ' × ' + item.quantity).join('; ') : order.items_summary),
    integerCell(order.total_qty), numberCell(order.subtotal ?? order.total_amount - (order.tax_amount ?? 0) - (order.takeaway_fee ?? 0)), numberCell(order.takeaway_fee ?? 0), numberCell(order.tax_amount ?? 0), numberCell(order.total_amount),
    textCell(orderStatusLabel(language, order.status)), textCell(order.paid ? yes : no), textCell(paymentLabel(language, order.payment_method)), textCell(order.synced ? yes : no),
    textCell(order.paid_at), textCell(receiptDate(order)), numberCell(recognized(order) ? order.total_amount : 0), textCell(order.paid && !order.paid_at ? unknownTime : ''),
  ])];
  const itemRows: SheetData = [[t('Order No.', '订单号', 'No. pesanan'), 'UID', t('Ordered at', '下单时间', 'Masa pesanan'), t('Item', '商品', 'Item'), t('Size', '份量', 'Saiz'), t('Options', '选项', 'Pilihan'), t('Add-ons', '加料', 'Tambahan'),
    t('Quantity', '件数', 'Kuantiti'), t('Unit Price (RM)', '单价 (RM)', 'Harga unit (RM)'), t('Line Total (RM)', '商品小计 (RM)', 'Jumlah item (RM)'), t('Receipt date', '收款归属日期', 'Tarikh terimaan'), t('Counted in receipts', '计入本期实收', 'Dikira sebagai terimaan')].map(headerCell)];
  for (const order of report.orders) for (const item of order.items) {
    const itemName = localized(item.itemName, language) || localized(settings.menuItems.find(menu => menu.id === item.menuItemId)?.name, language) || item.menuItemId;
    const options = [...(item.optionSelections ?? []).map(selection => localized(selection.groupNames, language) + ': ' + localized(selection.choiceNames, language)), ...(item.noodleBases ?? [])].join('; ');
    const extras = item.addOnSelections?.length ? item.addOnSelections.map(extra => localized(extra.name, language)).join('; ') : (item.addOns ?? []).join('; ');
    itemRows.push([textCell(order.order_id), textCell(order.local_order_id), textCell(order.timestamp), textCell(itemName), textCell(localized(item.sizeSelection?.name, language) || item.size || item.sizeId), textCell(options), textCell(extras), integerCell(item.quantity), numberCell(item.unitPrice), numberCell(item.totalPrice), textCell(receiptDate(order)), textCell(recognized(order) ? yes : no)]);
  }
  const summary: SheetData = [
    [headerCell(t('Summary', '汇总', 'Ringkasan')), headerCell(t('Value', '数值', 'Nilai'))],
    [textCell(t('Shop', '店铺', 'Kedai')), textCell(localized({en: settings.shopNameEn, zh: settings.shopNameZh, ms: settings.shopNameMs}, language))],
    [textCell(t('Period', '期间', 'Tempoh')), textCell(range.from + ' → ' + range.to)],
    [textCell(t('Time zone', '时区', 'Zon masa')), textCell('Asia/Kuala_Lumpur')],
    [textCell(t('Receipts (RM)', '实收 (RM)', 'Terimaan (RM)')), numberCell(report.totals.revenue)],
    [textCell(t('Cash (RM)', '现金 (RM)', 'Tunai (RM)')), numberCell(report.totals.cash)],
    [textCell(t('QR Pay (RM)', '扫码收款 (RM)', 'Bayaran QR (RM)')), numberCell(report.totals.qr)],
    [textCell(t('Paid orders', '收款订单数', 'Pesanan dibayar')), integerCell(report.totals.orders)],
    [textCell(t('Items sold', '已售件数', 'Item terjual')), integerCell(report.totals.quantity)],
    [textCell(t('Legacy paid records', '收款时间未知的旧记录', 'Rekod lama dibayar')), integerCell(report.legacyPaymentCount)],
    [textCell(t('Basis', '统计口径', 'Asas laporan')), textCell(t('Confirmed payments by receipt date, excluding cancelled orders. Old paid records without a receipt time use their order date.', '按确认收款日期统计，排除已取消订单。没有收款时间的旧已付记录按下单日归属。', 'Bayaran disahkan mengikut tarikh terimaan, tidak termasuk pesanan dibatalkan. Rekod lama tanpa masa terimaan menggunakan tarikh pesanan.'))],
    [textCell(t('Ledger', '明细口径', 'Lejar')), textCell(t('Orders created OR paid in the period appear once. Only the receipts column contributes to this report total.', '期间内下单或收款的订单各显示一次；只将「本期间实收」列计入本报表总额。', 'Pesanan dibuat ATAU dibayar dalam tempoh dipaparkan sekali. Hanya lajur terimaan dikira dalam jumlah laporan.'))],
  ];
  const daily: SheetData = [[t('Date', '日期', 'Tarikh'), t('Paid orders', '收款订单数', 'Pesanan dibayar'), t('Items sold', '已售件数', 'Item terjual'), t('Receipts (RM)', '实收 (RM)', 'Terimaan (RM)'), t('Cash (RM)', '现金 (RM)', 'Tunai (RM)'), t('QR Pay (RM)', '扫码收款 (RM)', 'Bayaran QR (RM)')].map(headerCell),
    ...report.daily.map(day => [textCell(day.date), integerCell(day.orders), integerCell(day.quantity), numberCell(day.revenue), numberCell(day.cash), numberCell(day.qr)])];
  const sheet = (name: string, data: SheetData, widths: number[]): OrderWorkbookSheet => ({sheet: name, data, columns: widths.map(width => ({width})), stickyRowsCount: 1, orientation: 'landscape'});
  return [sheet(t('Summary', '汇总', 'Ringkasan'), summary, [30, 90]), sheet(t('Daily', '每日汇总', 'Harian'), daily, [15, 18, 18, 20, 18, 18]),
    sheet(t('Orders', '订单', 'Pesanan'), orderRows, [12, 38, 22, 16, 12, 42, 12, 18, 18, 16, 18, 20, 12, 18, 18, 26, 18, 25, 52]),
    sheet(t('Order Items', '商品明细', 'Item Pesanan'), itemRows, [12, 38, 22, 28, 20, 34, 28, 12, 18, 18, 18, 22])];
}
export async function createOrderWorkbookBlob(orders: Order[], settings: ShopSettings, range?: ReportRange, language: Language = 'en'): Promise<Blob> {
  const {default: writeExcelFile} = await import('write-excel-file/browser');
  return writeExcelFile(buildOrderWorkbookSheets(orders, settings, range, language), {fontFamily: 'Arial', fontSize: 10}).toBlob();
}
export async function exportOrdersXlsx(orders: Order[], settings: ShopSettings, filename: string, range?: ReportRange, language: Language = 'en', options: SaveFileOptions = {}): Promise<FileSaveResult> {
  return saveFile(await createOrderWorkbookBlob(orders, settings, range, language), filename, XLSX_MIME, language, options);
}
