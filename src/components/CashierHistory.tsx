import {useEffect, useMemo, useState} from 'react';
import {Calendar, ChevronLeft, ChevronRight, FileSpreadsheet, LoaderCircle} from 'lucide-react';
import {useStore} from '../store';
import {formatCurrency} from '../utils';
import {localized, orderStatusLabel, paymentLabel, tr} from '../i18n';
import {buildSalesReport, getReportRange, inReportRange, receiptDate, reportingDate, type ReportPeriod} from '../domain/reporting';
import {isSalesOrder} from '../domain/sales';
import {fileErrorMessage} from '../domain/native-export';
import DataTools from './DataTools';

export default function CashierHistory() {
  const {orders, settings, language} = useStore();
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const [period, setPeriod] = useState<ReportPeriod | 'custom'>('day');
  const [customFrom, setCustomFrom] = useState(reportingDate);
  const [customTo, setCustomTo] = useState(reportingDate);
  const [anchor, setAnchor] = useState(reportingDate);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(50);
  const range = useMemo(() => period === 'custom' ? { from: customFrom, to: customTo } : getReportRange(period, anchor), [period, anchor, customFrom, customTo]);
  const validRange = range.from <= range.to;
  const report = useMemo(() => buildSalesReport(orders, range), [orders, range]);
  useEffect(() => {setVisible(50); setMessage(''); setError('');}, [period, anchor]);
  const move = (direction: number) => {
    const date = new Date(anchor + 'T00:00:00Z');
    if (period === 'day' || period === 'week') date.setUTCDate(date.getUTCDate() + direction * (period === 'day' ? 1 : 7));
    else if (period === 'month') {date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + direction);}
    else {date.setUTCDate(1); date.setUTCMonth(0); date.setUTCFullYear(date.getUTCFullYear() + direction);}
    setAnchor(date.toISOString().slice(0, 10));
  };
  const exportReport = async () => {
    if (isExporting || !validRange) return;
    setIsExporting(true); setMessage(''); setError('');
    try {
      const {exportOrdersXlsx} = await import('../domain/export-orders-xlsx');
      const result = await exportOrdersXlsx(orders, settings, 'CJ-POS-receipts-' + range.from + '-to-' + range.to + '.xlsx', range, language);
      setMessage(result.destination === 'native' ? t('Excel saved.', 'Excel 已保存。', 'Excel disimpan.') : t('Excel download started.', '已发起 Excel 下载。', 'Muat turun Excel dimulakan.'));
    } catch (failure) {setError(fileErrorMessage(failure, language));}
    finally {setIsExporting(false);}
  };
  const periods: {id: ReportPeriod | 'custom'; name: string}[] = [
    {id: 'day', name: t('Day', '日', 'Hari')}, {id: 'week', name: t('Week', '周', 'Minggu')},
    {id: 'month', name: t('Month', '月', 'Bulan')}, {id: 'year', name: t('Year', '年', 'Tahun')},
    {id: 'custom', name: t('Range', '自选', 'Julat')},
  ];
  const cards = [
    [t('Receipts', '实收', 'Terimaan'), formatCurrency(report.totals.revenue)],
    [t('Paid orders', '收款订单', 'Pesanan dibayar'), String(report.totals.orders)],
    [t('Items sold', '已售件数', 'Item terjual'), String(report.totals.quantity)],
    [t('Average per order', '平均每单', 'Purata setiap pesanan'), formatCurrency(report.totals.orders ? report.totals.revenue / report.totals.orders : 0)],
  ];
  return <div className="min-w-0 space-y-5">
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-800 p-1 sm:grid-cols-5">
      {periods.map(tab => <button type="button" key={tab.id} onClick={() => setPeriod(tab.id)} aria-pressed={period === tab.id} className={'min-h-11 min-w-0 rounded-lg px-2 py-2 text-sm font-bold ' + (period === tab.id ? 'bg-primary text-black' : 'text-zinc-300')}>{tab.name}</button>)}
    </div>
    <div className="flex min-w-0 flex-wrap items-end gap-3">
      {period === 'custom' ? <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm text-zinc-400">{t('From','开始','Dari')}<input type="date" value={customFrom} onChange={e => {if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setCustomFrom(e.target.value);}} className="mt-1 block min-h-12 w-full min-w-0 rounded-xl border border-zinc-600 bg-zinc-900 px-3 text-white" /></label>
        <label className="min-w-0 text-sm text-zinc-400">{t('To','结束','Hingga')}<input type="date" value={customTo} onChange={e => {if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setCustomTo(e.target.value);}} className="mt-1 block min-h-12 w-full min-w-0 rounded-xl border border-zinc-600 bg-zinc-900 px-3 text-white" /></label>
      </div> : <div className="flex w-full min-w-0 flex-none items-end gap-2 sm:w-auto sm:min-w-[18rem] sm:flex-1">
        <button type="button" onClick={() => move(-1)} aria-label={t('Previous period', '上一个期间', 'Tempoh sebelumnya')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-600"><ChevronLeft size={20}/></button>
        <label className="min-w-0 flex-1 text-sm text-zinc-400">{t('Date in this period', '选择期间内的日期', 'Tarikh dalam tempoh')}
          <input type="date" value={anchor} onChange={event => {if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setAnchor(event.target.value);}} className="mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-zinc-600 bg-zinc-900 px-3 text-base text-white"/>
        </label>
        <button type="button" onClick={() => move(1)} aria-label={t('Next period', '下一个期间', 'Tempoh seterusnya')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-600"><ChevronRight size={20}/></button>
      </div>}
      <button type="button" onClick={() => {setPeriod('day');setAnchor(reportingDate());}} className="min-h-11 rounded-xl border border-zinc-600 px-3 text-sm font-bold">{t('Today', '今天', 'Hari ini')}</button>
      <button type="button" onClick={exportReport} disabled={isExporting || !validRange} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-black disabled:opacity-50">{isExporting ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <FileSpreadsheet className="h-4 w-4"/>}{isExporting ? t('Saving…', '保存中…', 'Menyimpan…') : t('Export Excel', '导出 Excel', 'Eksport Excel')}</button>
    </div>
    <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-400"><Calendar className="h-4 w-4 shrink-0"/>{range.from} → {range.to}</p>
    {!validRange && <p role="alert" className="text-red-400">{t('The end date must be on or after the start date.','结束日期不能早于开始日期。','Tarikh akhir mesti selepas atau sama dengan tarikh mula.')}</p>}
    <p className="text-sm leading-relaxed text-zinc-400">{t('Receipts follow the payment date in Malaysia time. Unpaid and cancelled orders do not count.', '实收按马来西亚时间的收款日期统计，未付款及已取消订单不计入。', 'Terimaan mengikut tarikh bayaran dalam waktu Malaysia. Pesanan belum dibayar dan dibatalkan tidak dikira.')}</p>
    {report.legacyPaymentCount > 0 && <p className="rounded-xl bg-amber-950/40 p-3 text-sm text-amber-300">{t('Some older paid records have no receipt time and are assigned to their order date.', '部分旧已付记录没有收款时间，暂按下单日期归属。', 'Sesetengah rekod lama tiada masa terimaan dan menggunakan tarikh pesanan.')}</p>}
    {message && <p role="status" className="text-sm text-green-400">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map(([label, value]) => <div key={label} className="min-w-0 rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <div className="text-sm text-zinc-400">{label}</div><div className="mt-3 break-words text-[clamp(1.25rem,3vw,2rem)] font-extrabold tabular-nums leading-tight text-primary">{value}</div>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-zinc-800 p-3 text-sm">
      <span>{t('Cash', '现金', 'Tunai')}: <strong>{formatCurrency(report.totals.cash)}</strong></span>
      <span>{t('QR Pay', '扫码收款', 'Bayaran QR')}: <strong>{formatCurrency(report.totals.qr)}</strong></span>
    </div>
    {period !== 'day' && <section className="space-y-3">
      <h2 className="text-lg font-bold">{t('Daily receipts', '每日实收', 'Terimaan harian')}</h2>
      {report.daily.length === 0 ? <p className="text-sm text-zinc-400">{t('No payments in this period.', '这个期间没有收款记录。', 'Tiada bayaran dalam tempoh ini.')}</p> : <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
        {report.daily.map(day => <div key={day.date} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span>{day.date}</span><span className="text-zinc-400">{day.orders} {t('orders', '单', 'pesanan')} · {day.quantity} {t('items', '件', 'item')}</span><strong className="tabular-nums text-primary">{formatCurrency(day.revenue)}</strong></div>)}
      </div>}
    </section>}
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{t('Orders in this period', '本期间订单', 'Pesanan dalam tempoh')} ({report.orders.length})</h2>
      <p className="text-sm text-zinc-400">{t('Orders created or paid in this period. Each order appears once.', '期间内下单或收款的订单，每单只显示一次。', 'Pesanan dibuat atau dibayar dalam tempoh ini. Setiap pesanan dipaparkan sekali.')}</p>
      {report.orders.length === 0 && <p className="py-5 text-sm text-zinc-400">{t('No orders in this period.', '这个期间没有订单。', 'Tiada pesanan dalam tempoh ini.')}</p>}
      {[...report.orders].reverse().slice(0, visible).map(order => {
        const counted = isSalesOrder(order) && inReportRange(receiptDate(order), range);
        const summary = order.items.length ? order.items.map(item => (localized(item.itemName, language) || localized(settings.menuItems.find(menu => menu.id === item.menuItemId)?.name, language) || item.menuItemId) + ' × ' + item.quantity).join(', ') : order.items_summary;
        return <article key={order.local_order_id} className="min-w-0 space-y-2 rounded-xl border border-zinc-700 bg-zinc-900 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><strong>#{order.order_id}</strong><span className="text-sm text-zinc-400">{orderStatusLabel(language, order.status)} · {paymentLabel(language, order.paid ? order.payment_method : undefined)}</span></div>
          <p className="break-words text-sm">{summary}</p>
          <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
            <div className="space-y-1 text-zinc-400"><p>{t('Ordered: ', '下单：', 'Dipesan: ')}{order.timestamp}</p>{order.paid && <p>{t('Received: ', '收款：', 'Diterima: ')}{order.paid_at ? new Date(order.paid_at).toLocaleString(language === 'zh' ? 'zh-MY' : language === 'ms' ? 'ms-MY' : 'en-MY', {timeZone: 'Asia/Kuala_Lumpur'}) : t('Time unknown (legacy)', '时间未知（旧记录）', 'Masa tidak diketahui (lama)')}</p>}</div>
            <div className="text-right"><strong className="text-lg tabular-nums">{formatCurrency(order.total_amount)}</strong><p className={counted ? 'text-green-400' : 'text-zinc-400'}>{counted ? t('Included in receipts', '计入本期实收', 'Termasuk terimaan') : t('Not included in receipts', '不计入本期实收', 'Tidak termasuk terimaan')}</p></div>
          </div>
        </article>;
      })}
      {report.orders.length > visible && <button type="button" onClick={() => setVisible(count => count + 50)} className="min-h-11 w-full rounded-xl border border-zinc-700 py-2 font-bold">{t('Show more', '显示更多', 'Tunjuk lagi')}</button>}
    </section>
    <DataTools/>
  </div>;
}
