import { useRef, useState } from 'react';
import { useStore } from '../store';
import { tr } from '../i18n';
import { createMenuPack, menuPackFile } from '../sharing/menu-pack';
import { makeIssuedRecord, MENU_OPEN_URL, normalizeWhatsAppNumber, type MenuPack } from '../sharing/protocol';
import { sharingErrorMessage } from '../sharing/messages';
import { MENU_MIME, saveFile, shareFile } from '../domain/native-export';
import GuestMenu from './GuestMenu';

export default function ShareMenu() {
  const { settings, language, saveStatus, ensureShopIdentity, recordIssuedMenu } = useStore();
  const [phone, setPhone] = useState(settings.whatsappNumber ?? ''), [pack, setPack] = useState<MenuPack | null>(null);
  const [busy, setBusy] = useState(false), [preview, setPreview] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const lock = useRef(false);
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const generate = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setNotice(''); setPack(null);
    try {
      const number = normalizeWhatsAppNumber(phone);
      const shopId = await ensureShopIdentity(); if (!shopId) throw new Error('Unable to save shop identity');
      const snapshot = await createMenuPack({ ...settings, shopId }, number);
      if (!await recordIssuedMenu(makeIssuedRecord(snapshot), number)) throw new Error('Unable to save issued menu');
      setPhone(number); setPack(snapshot);
      setNotice(t('Menu ready. Preview it, then save or share the file.', '菜单包已生成，请预览后保存或分享文件。', 'Menu sedia. Pratonton, kemudian simpan atau kongsi fail.'));
    } catch (e) { setError(sharingErrorMessage(e, language)); }
    finally { setBusy(false); lock.current = false; }
  };
  const invitation = t(`Save this menu attachment, open ${MENU_OPEN_URL} and choose the .cjmenu file. Fill your order and send the receipt back here on WhatsApp.`, `请保存菜单附件，打开 ${MENU_OPEN_URL} 后选择 .cjmenu 文件。填好点单，再用 WhatsApp 把回单发回这里。`, `Simpan lampiran menu ini, buka ${MENU_OPEN_URL} dan pilih fail .cjmenu. Isi pesanan dan hantar resit kembali melalui WhatsApp.`);
  const filename = pack ? `CJ_Menu_${pack.menuId}.cjmenu` : '';
  const button = 'min-h-12 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary disabled:opacity-50';
  if (preview && pack) return <GuestMenu previewPack={pack} initialLanguage={language} onClose={() => setPreview(false)} />;
  return <section className="mx-auto max-w-3xl space-y-5 text-zinc-900 dark:text-white">
    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('Share your menu', '分享本店菜单', 'Kongsi menu kedai')}</h2>
    <p>{t('Generate a photo menu from your saved shop data. Customers save the attachment and open the menu webpage. No cloud menu or order database is used.', '从已保存的本店资料生成图文菜单。顾客保存附件，再打开菜单网页，不建立云端菜单或订单库。', 'Cipta menu bergambar daripada data kedai tersimpan. Pelanggan simpan lampiran dan buka halaman menu. Tiada pangkalan data menu atau pesanan awan.')}</p>
    <label className="block font-bold">{t('Receiving WhatsApp number (with country code)', 'WhatsApp 接单号码（含国家代码）', 'Nombor WhatsApp penerima (dengan kod negara)')}
      <input className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 bg-white p-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" type="tel" aria-label={t('Shop WhatsApp number', '店家 WhatsApp 号码', 'Nombor WhatsApp kedai')} placeholder="60123456789" value={phone} maxLength={30} disabled={busy} onChange={e => { setPhone(e.target.value); setPack(null); }} />
    </label>
    <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('Use your real shop number. Compressed photo copies are at most 1280 px; the menu file limit is 10 MB. Originals are kept.', '请填写真实店家号码。照片副本最长边 1280px，菜单包上限 10MB，保留原图。', 'Gunakan nombor sebenar kedai. Salinan foto sehingga 1280 px; had fail menu 10 MB. Foto asal dikekalkan.')}</p>
    <button className={button} disabled={busy || saveStatus === 'saving'} onClick={() => { void generate(); }}>{busy ? t('Generating and saving…', '正在生成并保存…', 'Menjana dan menyimpan…') : t('Generate menu file', '生成菜单包', 'Cipta fail menu')}</button>
    {error && <p role="alert" className="rounded-xl bg-red-100 p-4 text-red-900">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-100 p-4 text-emerald-950">{notice}</p>}
    {pack && <div className="space-y-4 rounded-2xl border border-zinc-300 p-4 dark:border-zinc-700">
      <p>{pack.settings.menuItems.length} {t('items', '个商品', 'item')} · {(menuPackFile(pack).size / 1024 / 1024).toFixed(2)} MB</p>
      <div className="flex flex-wrap gap-3">
        <button className={button} onClick={() => setPreview(true)}>{t('Preview customer page', '预览顾客页面', 'Pratonton halaman pelanggan')}</button>
        <button className={button} disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try {
            const result = await saveFile(menuPackFile(pack), filename, MENU_MIME, language);
            setNotice(result.destination === 'native' ? t('File saved. Send it with the instructions below.', '文件已保存，请附上以下说明发给顾客。', 'Fail disimpan. Hantar bersama arahan di bawah.') : t('Download started. Attach the downloaded file and instructions in WhatsApp.', '已开始下载，请在 WhatsApp 附上下载文件及下方说明。', 'Muat turun dimulakan. Lampirkan fail dan arahan dalam WhatsApp.'));
          }
          catch (e) { setError(sharingErrorMessage(e, language)); } finally { setBusy(false); }
        }}>{t('Save menu file', '保存菜单文件', 'Simpan fail menu')}</button>
        <button className={button} disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try {
            const result = await shareFile(menuPackFile(pack), filename, MENU_MIME, language, invitation);
            setNotice(result.downloaded ? t('File downloaded. Attach it to WhatsApp with the instructions below.', '文件已下载，请在 WhatsApp 附上文件及下方说明。', 'Fail dimuat turun. Lampirkan dalam WhatsApp bersama arahan di bawah.') : result.cancelled ? t('Sharing cancelled.', '已取消分享。', 'Perkongsian dibatalkan.') : t('Sharing panel opened. Choose WhatsApp, a customer, and send.', '已打开分享面板，请选 WhatsApp、顾客，并亲自发送。', 'Panel perkongsian dibuka. Pilih WhatsApp, pelanggan, dan hantar.'));
          } catch (e) { setError(sharingErrorMessage(e, language)); } finally { setBusy(false); }
        }}>{t('Share file', '分享文件', 'Kongsi fail')}</button>
      </div>
      <label className="block font-bold">{t('Send these instructions with the attachment', '随附件发送这段说明', 'Hantar arahan ini bersama lampiran')}<textarea aria-label={t('Menu instructions', '菜单打开说明', 'Arahan menu')} readOnly className="mt-2 min-h-36 w-full rounded-xl border bg-white p-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" value={invitation} /></label>
      <p className="text-sm">{t('Shared menus are snapshots. After changing prices or options, generate and send a new file.', '已分享菜单是当时的副本；改价或更改选项后，请重新生成并发送新文件。', 'Menu dikongsi ialah salinan pada masa itu. Selepas mengubah harga atau pilihan, cipta dan hantar fail baharu.')}</p>
    </div>}
  </section>;
}
