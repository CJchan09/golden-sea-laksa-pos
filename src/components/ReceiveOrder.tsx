import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { localized, tr } from '../i18n';
import { calculateOrderAmounts } from '../domain/order-amounts';
import { formatCurrency } from '../utils';
import { parseOrderRequest, readOrderFile, rebuildRequestCart, requestFingerprint, requestFromLink, requestMenuRevision, SharingError, type OrderRequest } from '../sharing/protocol';
import { sharingErrorMessage } from '../sharing/messages';
import RequestSummary from './RequestSummary';

export default function ReceiveOrder() {
  const { settings, orders, language, acceptIncomingOrder, storageError } = useStore();
  const [input, setInput] = useState(''), [request, setRequest] = useState<OrderRequest | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [accepted, setAccepted] = useState<{localOrderId: string; duplicate: boolean} | null>(null);
  const lock = useRef(false);
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const openLink = (value: string) => {
    setError(''); setAccepted(null); setRequest(null);
    try { setRequest(requestFromLink(value)); } catch (e) { setError(sharingErrorMessage(e, language)); }
  };
  useEffect(() => {
    const check = () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
      const payload = params.get('payload'); if (payload) openLink(payload);
    };
    check(); window.addEventListener('hashchange', check); return () => window.removeEventListener('hashchange', check);
  }, []);
  const preview = useMemo(() => {
    if (!request) return null;
    try {
      const valid = parseOrderRequest(request);
      if (valid.shopId !== settings.shopId) throw new SharingError('WRONG_SHOP');
      const existing = orders.find(o => o.sourceRequestId === valid.requestId);
      if (existing) {
        if (existing.sourceFingerprint !== requestFingerprint(valid)) throw new SharingError('REQUEST_CONFLICT');
        return { cart: existing.items, totalSen: Math.round(existing.total_amount * 100), duplicate: existing.local_order_id, error: '', changed: false, differences: [], revision: undefined };
      }
      const issued = settings.issuedMenus?.find(m => m.menuId === valid.menuId);
      if (!issued) throw new SharingError('UNKNOWN_MENU');
      const originalCart = rebuildRequestCart(valid, issued);
      const originalAmounts = calculateOrderAmounts(originalCart, { ...settings, ...issued }, 'Takeaway');
      if (Math.round(originalAmounts.totalAmount * 100) !== valid.quotedTotalSen) throw new SharingError('QUOTE_MISMATCH');
      const cart = rebuildRequestCart(valid, settings), totalSen = Math.round(calculateOrderAmounts(cart, settings, 'Takeaway').totalAmount * 100);
      const revision = requestMenuRevision(valid, settings);
      const namesKey = (names: { en?: string; zh?: string; ms?: string } | undefined) => JSON.stringify({ en: (names?.en ?? '').trim(), zh: (names?.zh ?? '').trim(), ms: (names?.ms ?? '').trim() });
      const differences = cart.flatMap((item, index) => {
        const old = originalCart[index], changes: string[] = [];
        const label = (names: { en?: string; zh?: string; ms?: string } | undefined) => names ? localized(names, language) : item.menuItemId;
        if (item.unitPrice !== old.unitPrice) changes.push(`${item.quantity} × ${label(item.itemName)}: ${formatCurrency(old.unitPrice)} → ${formatCurrency(item.unitPrice)}`);
        if (namesKey(item.itemName) !== namesKey(old.itemName)) changes.push(`${t('Item name', '商品名称', 'Nama item')}: ${label(old.itemName)} → ${label(item.itemName)}`);
        for (const option of item.optionSelections ?? []) {
          const previous = old.optionSelections?.find(o => o.optionGroupId === option.optionGroupId && o.choiceId === option.choiceId);
          if (previous && (namesKey(previous.groupNames) !== namesKey(option.groupNames) || namesKey(previous.choiceNames) !== namesKey(option.choiceNames)))
            changes.push(`${t('Option', '选项', 'Pilihan')}: ${label(previous.groupNames)} / ${label(previous.choiceNames)} → ${label(option.groupNames)} / ${label(option.choiceNames)}`);
        }
        return changes;
      });
      return { cart, totalSen, duplicate: null, error: '', changed: revision !== requestMenuRevision(valid, { ...settings, ...issued }), differences, revision };
    } catch (e) { return { cart: [], totalSen: 0, duplicate: null, error: sharingErrorMessage(e, language), changed: false, differences: [], revision: undefined }; }
  }, [request, settings, orders, language]);
  const confirm = async () => {
    if (!request || !preview || preview.error || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await acceptIncomingOrder(request, preview.totalSen, preview.revision);
      if (!result) throw new Error('SAVE_FAILED'); setAccepted(result);
    } catch (e) { setError(sharingErrorMessage(e, language)); }
    finally { lock.current = false; setBusy(false); }
  };
  const button = 'min-h-12 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary disabled:opacity-50';
  return <section className="mx-auto max-w-3xl space-y-5 text-zinc-900 dark:text-white">
    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('Receive customer receipt', '接收顾客回单', 'Terima resit pelanggan')}</h2>
    <p>{t('Open a receipt link, paste it below, or choose a .cjorder file. An order is created only after you confirm. Your register cart is kept.', '打开回单链接、在下方粘贴，或选择 .cjorder 文件。确认后才建立订单，收银台购物车会保留。', 'Buka pautan resit, tampal di bawah, atau pilih fail .cjorder. Pesanan dibuat selepas anda mengesahkan. Troli daftar dikekalkan.')}</p>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); openLink(input); }}>
      <label className="block font-bold">{t('Receipt link', '回单链接', 'Pautan resit')}<textarea aria-label={t('Receipt link', '回单链接', 'Pautan resit')} className="mt-2 min-h-28 w-full rounded-xl border border-zinc-300 bg-white p-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" value={input} maxLength={8000} onChange={e => setInput(e.target.value)} /></label>
      <button className={button} type="submit" disabled={!input || busy}>{t('Open preview', '打开预览', 'Buka pratonton')}</button>
    </form>
    <label className={`inline-flex min-h-12 cursor-pointer items-center rounded-xl border px-4 py-3 font-bold ${busy ? 'pointer-events-none opacity-50' : ''}`}>{t('Choose receipt file', '选择回单文件', 'Pilih fail resit')}<input className="sr-only" aria-label={t('Receipt file', '回单文件', 'Fail resit')} type="file" accept=".cjorder,application/vnd.cjpos.order+json,application/json" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      setError(''); setAccepted(null); setRequest(null);
      try { setRequest(await readOrderFile(file)); } catch (err) { setError(sharingErrorMessage(err, language)); }
    }} /></label>
    {(error || preview?.error || storageError) && <p role="alert" className="rounded-xl bg-red-100 p-4 text-red-900">{error || preview?.error || storageError}</p>}
    {accepted ? <div className="space-y-4 rounded-xl bg-emerald-100 p-5 text-emerald-950">
      <h3 className="text-xl font-bold">{accepted.duplicate ? t('Already received — no second order created', '已接收，没有重复建立订单', 'Sudah diterima — tiada pesanan kedua') : t('Order saved — unpaid, waiting for preparation', '订单已保存：未付款、待制作', 'Pesanan disimpan — belum dibayar, menunggu penyediaan')}</h3>
      <p>{t('Order number', '订单号', 'Nombor pesanan')}: {orders.find(o => o.local_order_id === accepted.localOrderId)?.order_id ?? accepted.localOrderId}</p>
      <div className="flex flex-wrap gap-3"><a className={button} href="#/cashier/kitchen">{t('Go to Kitchen', '去备餐', 'Pergi ke dapur')}</a><a className={button} href={`#/cashier/active?order=${encodeURIComponent(accepted.localOrderId)}`}>{t('Go to payment', '去收款', 'Pergi ke bayaran')}</a></div>
    </div> : request && preview && !preview.error && <div className="space-y-5 rounded-2xl border border-zinc-300 p-5 dark:border-zinc-700">
      <p className="break-all text-sm">{t('Receipt ID', '回单编号', 'ID resit')}: {request.requestId}</p>
      {preview.duplicate ? <p className="font-bold">{t('This receipt was already accepted. View the existing order; no duplicate will be created.', '这张回单已经接收，查看已有订单，不会重复建立。', 'Resit ini sudah diterima. Lihat pesanan sedia ada; tiada pendua dibuat.')}</p> : <RequestSummary cart={preview.cart} settings={settings} language={language} customer={request.customer} />}
      {preview.changed && <p role="alert" className="rounded-xl bg-amber-100 p-4 text-amber-950">{t(`Menu or charges changed. Customer amount ${formatCurrency(request.quotedTotalSen / 100)}; current amount ${formatCurrency(preview.totalSen / 100)}. Confirm the changes with the customer before accepting.`, `菜单内容或收费已有变动。顾客金额 ${formatCurrency(request.quotedTotalSen / 100)}，本机金额 ${formatCurrency(preview.totalSen / 100)}，请与顾客核对变动后再确认。`, `Menu atau caj berubah. Jumlah pelanggan ${formatCurrency(request.quotedTotalSen / 100)}; jumlah semasa ${formatCurrency(preview.totalSen / 100)}. Sahkan perubahan dengan pelanggan sebelum menerima.`)}</p>}
      {preview.differences.length > 0 && <ul className="list-disc space-y-2 pl-5">{preview.differences.map((d, i) => <li key={i}>{d}</li>)}</ul>}
      <p>{t('Creates an unpaid takeaway order. Payment must be confirmed by staff.', '将建立未付款打包单，收款须由店员确认。', 'Membuat pesanan bungkus belum dibayar. Bayaran mesti disahkan oleh kakitangan.')}</p>
      <button className={button + ' w-full'} disabled={busy} onClick={() => { void confirm(); }}>{busy ? t('Saving…', '保存中…', 'Menyimpan…') : preview.duplicate ? t('View existing order', '查看已有订单', 'Lihat pesanan sedia ada') : t('Confirm and add order', '确认加入订单', 'Sahkan dan tambah pesanan')}</button>
    </div>}
  </section>;
}
