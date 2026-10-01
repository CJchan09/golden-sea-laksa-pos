import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { registerSW } from 'virtual:pwa-register';
import { ImageOff, Minus, Plus, ShoppingBag } from 'lucide-react';
import type { CartItem, Language, MenuItem } from '../types';
import { localized, tr } from '../i18n';
import { createDemoBaselineSettings } from '../demo-baseline';
import { getCartItemDisplay } from '../domain/cart-item-display';
import { formatCurrency } from '../utils';
import { ORDER_MIME, saveFile, shareFile } from '../domain/native-export';
import { GuestDraftRepository, emptyGuestDraft, type GuestDraft } from '../sharing/guest-db';
import { createMenuPack } from '../sharing/menu-pack';
import { parseMenuPack, parseOrderRequest, readMenuFile, receiptLink, rebuildRequestCart, requestFile, requestFromCart, type MenuPack } from '../sharing/protocol';
import { sharingErrorMessage } from '../sharing/messages';
import { upsertGuestCartItem } from '../sharing/guest-cart';
import LanguageSelector from './LanguageSelector';
import CustomizationModal from './CustomizationModal';
import RequestSummary from './RequestSummary';

export default function GuestMenu({ previewPack, onClose, initialLanguage = 'en' }: { previewPack?: MenuPack; onClose?: () => void; initialLanguage?: Language }) {
  const demo = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('demo') === '1';
  const repository = useRef(new GuestDraftRepository(demo ? 'demo' : 'guest'));
  const initial = { ...emptyGuestDraft(), language: initialLanguage, pack: previewPack ?? null };
  const [draft, setDraft] = useState<GuestDraft>(initial);
  const current = useRef(draft), queue = useRef(Promise.resolve()), pending = useRef(0), lock = useRef(false);
  const [ready, setReady] = useState(!!previewPack), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<{ item: MenuItem; cart?: CartItem; pendingCartId: string } | null>(null);
  const [offlineReady, setOfflineReady] = useState(false), [notice, setNotice] = useState('');
  const language = draft.language, pack = draft.pack;
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  useEffect(() => {
    if (previewPack) return;
    let active = true;
    repository.current.read().then(async stored => {
      let next = stored ?? { ...emptyGuestDraft(), language: initialLanguage };
      if (next.pack) next.pack = parseMenuPack(next.pack);
      if (next.request) {
        next.request = parseOrderRequest(next.request);
        if (!next.pack || next.request.shopId !== next.pack.shopId || next.request.menuId !== next.pack.menuId) throw new Error('INVALID_DRAFT');
        rebuildRequestCart(next.request, next.pack.settings);
      }
      if (demo && !next.pack) {
        const settings = { ...createDemoBaselineSettings(), shopId: 'cjpos-isolated-demo' };
        next = { ...next, pack: await createMenuPack(settings, '60123456789') };
        await repository.current.save(next);
      }
      if (active) { current.current = next; setDraft(next); setReady(true); }
    }).catch(e => { if (active) setError(sharingErrorMessage(e, initialLanguage)); });
    registerSW({ immediate: true, onOfflineReady: () => { if (active) setOfflineReady(true); } });
    return () => { active = false; };
  }, []);
  const update = (patch: Partial<GuestDraft>): Promise<boolean> => {
    if (lock.current || (!ready && !previewPack)) return Promise.resolve(false);
    const next = { ...current.current, ...patch }; current.current = next; setDraft(next);
    if (previewPack) return Promise.resolve(true);
    pending.current++; setSaving(true); setError('');
    const work = queue.current.then(() => repository.current.save(next));
    queue.current = work.catch(() => {});
    return work.then(() => true).catch(e => { setError(sharingErrorMessage(e, language)); return false; }).finally(() => {
      pending.current--; if (!pending.current) setSaving(false);
    });
  };
  const openMenu = async (file: File) => {
    try {
      const opened = await readMenuFile(file);
      if (pack && (draft.cart.length || draft.request) && !window.confirm(t('Replace the current customer draft with this menu?', '要用这份菜单替换当前顾客草稿吗？', 'Gantikan draf semasa dengan menu ini?'))) return;
      await update({ ...emptyGuestDraft(), language, pack: opened });
    } catch (e) { setError(sharingErrorMessage(e, language)); }
  };
  const settings = pack ? { ...pack.settings, qrImage: null } : null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!pack || !draft.cart.length || lock.current || previewPack) return;
    lock.current = true;
    setCreating(true); setSaving(true); setError('');
    try {
      const request = requestFromCart(pack, draft.cart, draft.customer, language);
      rebuildRequestCart(request, pack.settings);
      requestFile(request);
      const next = { ...current.current, request };
      const work = queue.current.then(() => repository.current.save(next));
      queue.current = work.catch(() => {});
      await work;
      current.current = next; setDraft(next);
    } catch (e) { setError(sharingErrorMessage(e, language)); }
    finally { lock.current = false; setCreating(false); setSaving(false); }
  };
  const request = draft.request, link = request ? receiptLink(request) : null;
  const summary = request && settings ? [
    t(`Order request ${request.requestId}`, `点单回单 ${request.requestId}`, `Permintaan pesanan ${request.requestId}`),
    ...rebuildRequestCart(request, settings).map(item => {
      const d = getCartItemDisplay(item, settings.menuItems.find(m => m.id === item.menuItemId), language);
      return `${item.quantity} × ${d.itemName}${d.details.length ? ' (' + d.details.join(', ') + ')' : ''} = ${formatCurrency(item.totalPrice)}`;
    }), t(`Total: ${formatCurrency(request.quotedTotalSen / 100)}`, `总额：${formatCurrency(request.quotedTotalSen / 100)}`, `Jumlah: ${formatCurrency(request.quotedTotalSen / 100)}`),
    `${t('Name', '姓名', 'Nama')}: ${request.customer.name}`, `${t('Phone', '电话', 'Telefon')}: ${request.customer.phone}`,
    `${t('Address', '地址', 'Alamat')}: ${request.customer.address}`, request.customer.note || '',
    t('Unpaid · waiting for shop confirmation', '未付款 · 待店家确认', 'Belum dibayar · menunggu pengesahan kedai'),
    link ?? t('Please attach the .cjorder receipt file.', '请附上 .cjorder 回单文件。', 'Sila lampirkan fail resit .cjorder.'),
  ].filter(Boolean).join('\n') : '';
  const shareReceipt = async () => {
    if (!request) return;
    try {
      const result = await shareFile(requestFile(request), `CJ_Order_${request.requestId}.cjorder`, ORDER_MIME, language, summary);
      setNotice(result.downloaded ? t('File downloaded. Attach it in WhatsApp and send to the shop.', '文件已下载，请在 WhatsApp 附上并发给店家。', 'Fail dimuat turun. Lampirkan dalam WhatsApp dan hantar kepada kedai.') : result.cancelled ? t('Sharing cancelled.', '已取消分享。', 'Perkongsian dibatalkan.') : t('Sharing panel opened. Choose WhatsApp and confirm sending.', '已打开分享面板，请选 WhatsApp 并亲自发送。', 'Panel perkongsian dibuka. Pilih WhatsApp dan sahkan penghantaran.'));
    } catch (e) { setError(sharingErrorMessage(e, language)); }
  };
  const field = 'min-h-12 w-full rounded-xl border border-zinc-300 bg-white p-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';
  const button = 'min-h-12 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary disabled:opacity-50';
  return <div className="pos-app min-h-dvh bg-zinc-50 font-display text-zinc-900 dark:bg-black dark:text-white">
    <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{previewPack ? t('Menu preview', '菜单预览', 'Pratonton menu') : t('Open a shop menu', '打开店家菜单', 'Buka menu kedai')}</h1>
        <fieldset disabled={creating || !ready} className="flex flex-wrap gap-2"><LanguageSelector language={language} onChange={lang => { void update({ language: lang }); }} />
          {onClose && <button className={button} onClick={onClose}>{t('Back', '返回', 'Kembali')}</button>}
        </fieldset>
      </div>
    </header>
    <main className="mx-auto max-w-7xl space-y-6 p-4 pb-12">
      {previewPack && <p className="rounded-xl bg-amber-100 p-4 text-amber-950">{t('Preview only. This does not create an order.', '仅预览，不会建立订单。', 'Pratonton sahaja. Tiada pesanan dibuat.')}</p>}
      {demo && !previewPack && <p className="rounded-xl bg-amber-100 p-4 text-amber-950">{t('Demo form. Uses a separate draft. Do not send this example to a real shop.', '表单示范，草稿独立保存，请勿把示范回单发给真实店家。', 'Borang demo. Draf berasingan. Jangan hantar contoh ini kepada kedai sebenar.')}</p>}
      {!previewPack && <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p>{t('Save the .cjmenu attachment from WhatsApp, then choose it here. First visit needs internet. After loading, you can fill offline; WhatsApp sending needs internet.', '先把 WhatsApp 的 .cjmenu 附件保存到电话，再在这里选择。首次打开需联网；载入后可离线填单，WhatsApp 发送需联网。', 'Simpan lampiran .cjmenu daripada WhatsApp, kemudian pilih di sini. Lawatan pertama perlu internet. Selepas dimuatkan, isi luar talian; WhatsApp perlu internet.')}</p>
        <label className={`inline-flex min-h-12 cursor-pointer items-center rounded-xl border px-4 py-3 font-bold ${!ready || saving ? 'pointer-events-none opacity-50' : ''}`}>{t('Choose menu file', '选择菜单文件', 'Pilih fail menu')}<input aria-label={t('Menu file', '菜单文件', 'Fail menu')} className="sr-only" type="file" accept=".cjmenu,application/vnd.cjpos.menu+json,application/json" disabled={!ready || saving} onChange={e => { const f = e.target.files?.[0]; if (f) void openMenu(f); e.target.value = ''; }} /></label>
        <p role="status" className="text-sm">{!ready ? t('Opening customer storage…', '正在打开顾客草稿…', 'Membuka draf pelanggan…') : saving ? t('Saving…', '保存中…', 'Menyimpan…') : error ? t('Save failed. Retry before sending.', '保存失败，请重试后再发送。', 'Gagal disimpan. Cuba semula sebelum menghantar.') : t('Draft saved on this device', '草稿已保存到本机', 'Draf disimpan pada peranti ini')}{offlineReady && ' · ' + t('Offline page ready', '离线页面已准备好', 'Halaman luar talian sedia')}</p>
      </div>}
      {error && <div role="alert" className="space-y-3 rounded-xl bg-red-100 p-4 text-red-900"><p>{error}</p><button className={button} onClick={() => { if (!ready) window.location.reload(); else void update({}); }}>{t('Retry save', '重试保存', 'Cuba simpan semula')}</button></div>}
      {notice && <p role="status">{notice}</p>}
      {pack && settings && <>
        <section className="overflow-hidden rounded-2xl bg-zinc-950 text-white">
          {pack.settings.coverPhoto && <img className="max-h-72 w-full object-cover" src={pack.settings.coverPhoto} alt="" />}
          <div className="p-5"><h2 className="text-2xl font-bold">{localized({ en: settings.shopNameEn, zh: settings.shopNameZh, ms: settings.shopNameMs }, language)}</h2><p className="mt-2 text-sm">{t('Takeaway order · no online payment', '打包点单 · 无线上付款', 'Pesanan bungkus · tiada bayaran dalam talian')}</p></div>
        </section>
        {request ? <section className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-2xl font-bold">{t('Waiting for shop confirmation', '待店家确认', 'Menunggu pengesahan kedai')}</h2>
          <p className="break-all text-sm">{request.requestId}</p>
          <RequestSummary cart={rebuildRequestCart(request, settings)} settings={settings} language={language} customer={request.customer} />
          <p>{t('Your order is not in the shop POS until the shop reviews and accepts it. Sharing again keeps the same receipt ID.', '店家查看并确认后才会加入 POS。再次分享会沿用同一回单编号。', 'Pesanan masuk POS selepas kedai menyemak dan menerima. Berkongsi semula menggunakan ID resit yang sama.')}</p>
          <p className="text-sm">{t('The receipt contains your contact details. Only share it with the intended shop.', '回单包含你的联络资料，请只发给接单店家。', 'Resit mengandungi butiran hubungan anda. Kongsi hanya dengan kedai yang dimaksudkan.')}</p>
          <div className="flex flex-wrap gap-3">
            {!demo && !saving && !error && <a className={button} href={`https://wa.me/${pack.whatsappNumber}?text=${encodeURIComponent(summary)}`} target="_blank" rel="noopener noreferrer">{link ? t('Return via WhatsApp', 'WhatsApp 回传', 'Hantar melalui WhatsApp') : t('Open WhatsApp and attach receipt file', '打开 WhatsApp 并附上回单文件', 'Buka WhatsApp dan lampirkan fail resit')}</a>}
            <button className={button} disabled={saving || !!error} onClick={() => { void shareReceipt(); }}>{t('Share receipt file', '分享回单文件', 'Kongsi fail resit')}</button>
            <button className={button} disabled={saving || !!error} onClick={() => { void saveFile(requestFile(request), `CJ_Order_${request.requestId}.cjorder`, ORDER_MIME, language).catch(e => setError(sharingErrorMessage(e, language))); }}>{t('Save receipt file', '保存回单文件', 'Simpan fail resit')}</button>
          </div>
          {!link && <p className="font-bold">{t('This receipt is too long for a link. Attach the saved .cjorder file in WhatsApp with this summary.', '回单超过链接长度，请在 WhatsApp 附上已保存的 .cjorder 文件及以下摘要。', 'Resit terlalu panjang untuk pautan. Lampirkan fail .cjorder bersama ringkasan ini dalam WhatsApp.')}</p>}
          <label className="block font-bold">{t('Copyable order summary', '可复制的回单摘要', 'Ringkasan boleh disalin')}<textarea aria-label={t('Order summary', '回单摘要', 'Ringkasan pesanan')} className={field + ' mt-2 h-48'} readOnly value={summary} /></label>
          <button className="min-h-12 rounded-xl border px-4 py-3 font-bold" onClick={() => { if (window.confirm(t('Start a new request? Send the previous one only once.', '要新开一张回单吗？上一张请只发送一次。', 'Mulakan pesanan baharu? Hantar pesanan lama sekali sahaja.'))) void update({ cart: [], request: null }); }}>{t('Start a new order', '开始新点单', 'Mulakan pesanan baharu')}</button>
        </section> : <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section><h2 className="mb-4 text-xl font-bold">{t('Choose your items', '选择商品', 'Pilih item')}</h2>
            <div className="grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
              {settings.menuItems.map(item => <button key={item.id} className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left dark:border-zinc-800 dark:bg-zinc-950" disabled={!ready || creating} onClick={() => setSelected({ item, pendingCartId: uuidv4() })}>
                {item.image ? <img className="aspect-[4/3] w-full object-cover" src={item.image} alt={localized(item.name, language)} /> : <div className="flex aspect-[4/3] items-center justify-center bg-zinc-100 dark:bg-zinc-800"><ImageOff aria-hidden="true" /></div>}
                <div className="space-y-2 p-4"><h3 className="break-words text-base font-bold">{localized(item.name, language)}</h3><p className="font-bold">{formatCurrency(item.basePrice)}</p><p className="text-sm">{t('Choose options', '选择选项', 'Pilih pilihan')}</p></div>
              </button>)}
            </div>
          </section>
          <aside className="min-w-0 space-y-5 self-start rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 xl:sticky xl:top-4">
            <h2 className="flex items-center gap-2 text-xl font-bold"><ShoppingBag aria-hidden="true" />{t('Your order', '你的点单', 'Pesanan anda')}</h2>
            {!draft.cart.length && <p>{t('Choose an item to begin.', '选择商品开始点单。', 'Pilih item untuk bermula.')}</p>}
            {draft.cart.map(item => {
              const display = getCartItemDisplay(item, settings.menuItems.find(m => m.id === item.menuItemId), language);
              return <div key={item.id} className="space-y-2 border-b border-zinc-200 pb-3 dark:border-zinc-800"><p className="font-bold">{display.itemName}</p><p className="text-sm">{display.details.join(' · ')}</p>
                <div className="flex flex-wrap items-center gap-2"><button className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border" aria-label={t('Decrease quantity', '减少数量', 'Kurangkan kuantiti')} disabled={saving} onClick={() => { void update({ cart: draft.cart.flatMap(c => c.id !== item.id ? [c] : c.quantity === 1 ? [] : [{ ...c, quantity: c.quantity - 1, totalPrice: Math.round(c.unitPrice * (c.quantity - 1) * 100) / 100 }]) }); }}><Minus aria-hidden="true" /></button><span className="font-bold">{item.quantity}</span><button className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border" aria-label={t('Increase quantity', '增加数量', 'Tambah kuantiti')} disabled={saving || item.quantity >= 999} onClick={() => { void update({ cart: draft.cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1, totalPrice: Math.round(c.unitPrice * (c.quantity + 1) * 100) / 100 } : c) }); }}><Plus aria-hidden="true" /></button>
                  <button disabled={creating} className="min-h-12 rounded-xl border px-3 font-bold" onClick={() => setSelected({ item: settings.menuItems.find(m => m.id === item.menuItemId)!, cart: item, pendingCartId: item.id })}>{t('Edit options', '更改选项', 'Ubah pilihan')}</button></div>
              </div>;
            })}
            {draft.cart.length > 0 && <RequestSummary cart={draft.cart} settings={settings} language={language} />}
            <form className="space-y-4" onSubmit={submit}>
              <fieldset disabled={creating} className="space-y-4">
              {(['name', 'phone', 'address', 'note'] as const).map(key => <label key={key} className="block font-bold">{({ name: t('Name *', '姓名 *', 'Nama *'), phone: t('Phone *', '电话号码 *', 'Telefon *'), address: t('Address *', '地址 *', 'Alamat *'), note: t('Note (optional)', '备注（选填）', 'Nota (pilihan)') })[key]}
                {key === 'address' || key === 'note' ? <textarea className={field + ' mt-2'} aria-label={key === 'address' ? t('Address', '地址', 'Alamat') : t('Note', '备注', 'Nota')} required={key === 'address'} maxLength={key === 'address' ? 500 : 1000} value={draft.customer[key]} onChange={e => { void update({ customer: { ...current.current.customer, [key]: e.target.value } }); }} /> : <input className={field + ' mt-2'} required type={key === 'phone' ? 'tel' : 'text'} aria-label={key === 'name' ? t('Name', '姓名', 'Nama') : t('Phone', '电话号码', 'Telefon')} autoComplete={key === 'name' ? 'name' : 'tel'} maxLength={key === 'name' ? 120 : 30} value={draft.customer[key]} onChange={e => { void update({ customer: { ...current.current.customer, [key]: e.target.value } }); }} />}
              </label>)}
              <button type="submit" className={button + ' w-full'} disabled={!draft.cart.length || saving || !!error || !!previewPack}>{t('Review and create receipt', '核对并生成回单', 'Semak dan cipta resit')}</button>
              </fieldset>
            </form>
          </aside>
        </div>}
      </>}
      {!pack && ready && <p>{t('Waiting for your .cjmenu file. No merchant POS data is changed.', '等待选择 .cjmenu 文件，不会改动商家 POS 资料。', 'Menunggu fail .cjmenu. Data POS kedai tidak diubah.')}</p>}
    </main>
    {selected && <CustomizationModal item={selected.item} language={language} initialCartItem={selected.cart} onClose={() => setSelected(null)} onAdd={async item => {
      const next = upsertGuestCartItem(current.current.cart, item, selected.pendingCartId);
      return update({ cart: next });
    }} />}
  </div>;
}
