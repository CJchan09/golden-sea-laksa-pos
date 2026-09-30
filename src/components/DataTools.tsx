import {useRef, useState, useSyncExternalStore} from 'react';
import {useStore} from '../store';
import {tr} from '../i18n';
import type {BackupPreview} from '../storage/cjpos-backup';
import {AUTO_EXPORT_EVENT, getAutoExportStatus, subscribeAutoExport} from '../domain/auto-export';
import {BACKUP_MIME, chooseExportFolder, disableAutoExport, fileErrorMessage, isNativeApp, saveFile} from '../domain/native-export';
import {reportingDate} from '../domain/reporting';

export default function DataTools() {
  const {language, ready, createBackup, previewBackup, restoreBackup} = useStore();
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const status = useSyncExternalStore(subscribeAutoExport, getAutoExportStatus);
  const button = 'min-h-11 rounded-xl border border-zinc-600 px-4 py-2 text-sm font-bold disabled:opacity-50';
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setMessage(''); setError('');
    try {await action();} catch (failure) {setError(fileErrorMessage(failure, language));}
    finally {setBusy(false);}
  };
  const backup = () => run(async () => {
    const blob = await createBackup();
    const filename = 'CJ-POS-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.cjpos';
    const result = await saveFile(blob, filename, BACKUP_MIME, language);
    setMessage(result.destination === 'native' ? t('Full backup saved.', '完整备份已保存。', 'Sandaran penuh disimpan.') : t('Backup download started. Keep this file somewhere safe.', '已发起备份下载，请妥善保管文件。', 'Muat turun sandaran dimulakan. Simpan fail di tempat selamat.'));
  });
  const choose = () => run(async () => {
    await chooseExportFolder(reportingDate(), language);
    window.dispatchEvent(new Event(AUTO_EXPORT_EVENT));
    setMessage(t('Folder selected. Daily reports will save while the app is open.', '文件夹已选择，App 开着时会自动保存日报。', 'Folder dipilih. Laporan harian akan disimpan semasa app dibuka.'));
  });
  const stop = () => run(async () => {await disableAutoExport(); window.dispatchEvent(new Event(AUTO_EXPORT_EVENT)); setMessage(t('Automatic saving paused. Existing files are kept.', '自动保存已暂停，已有文件保留。', 'Simpanan automatik dijeda. Fail sedia ada dikekalkan.'));});
  const readBackup = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {setPreview(await previewBackup(file));}
    catch {setError(t('This backup is invalid or unsupported. Current records were not changed.', '备份无效或版本不支持，现有资料没有更改。', 'Sandaran tidak sah atau tidak disokong. Rekod semasa tidak diubah.'));}
    finally {setBusy(false); if (input.current) input.current.value = '';}
  };
  const restore = () => run(async () => {
    if (!preview) return;
    const restored = await restoreBackup(preview);
    if (!restored) {setError(t('Restore failed. Current records were preserved.', '恢复失败，原有资料已保留。', 'Pemulihan gagal. Rekod asal dikekalkan.')); return;}
    setPreview(null);
    window.dispatchEvent(new Event(AUTO_EXPORT_EVENT));
    setMessage(tr(preview.document.state.language, 'Backup restored on this device.', '备份已恢复到本机。', 'Sandaran dipulihkan pada peranti ini.'));
  });
  return <section className="min-w-0 space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-4 sm:p-5">
    <h2 className="text-lg font-bold">{t('Reports & backup', '报表与备份', 'Laporan & sandaran')}</h2>
    <p className="text-sm leading-relaxed text-zinc-400">{t('Excel is a sales report. A full backup also keeps your menu, photos, settings and all orders. Keep a copy outside the app before changing phones or uninstalling.', 'Excel 是销售报表；完整备份还包括菜单、照片、设置和全部订单。换电话或卸载前，请在 App 外保留一份备份。', 'Excel ialah laporan jualan. Sandaran penuh turut menyimpan menu, foto, tetapan dan semua pesanan. Simpan salinan di luar app sebelum menukar telefon atau menyahpasang.')}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !ready} onClick={backup} className={button}>{t('Save full backup', '保存完整备份', 'Simpan sandaran penuh')}</button>
      <button type="button" disabled={busy || !ready} onClick={() => input.current?.click()} className={button}>{t('Restore backup', '恢复备份', 'Pulihkan sandaran')}</button>
      <input ref={input} type="file" accept=".cjpos,application/vnd.cjpos.backup+json,application/json" className="hidden" onChange={event => void readBackup(event.target.files?.[0])} />
    </div>
    {isNativeApp() ? <div className="space-y-3 border-t border-zinc-700 pt-4">
      <h3 className="font-bold">{t('Automatic daily Excel', '自动保存每日 Excel', 'Excel harian automatik')}</h3>
      <p className="text-sm text-zinc-400">{t('Choose a folder once. Updates save after 10 seconds while the app is open; missed files retry when you reopen it. Updated reports are saved as new dated versions, preserving earlier files.', '首次选择文件夹后，App 开着时会在资料更新约 10 秒后保存；重开会补存遗漏文件。日报有改动时保存带时间的新版本，保留原文件。', 'Pilih folder sekali. Kemas kini disimpan selepas 10 saat semasa app dibuka; fail tertangguh dicuba semula apabila dibuka. Laporan dikemas kini sebagai versi baharu bertarikh, mengekalkan fail terdahulu.')}</p>
      {status.folder?.enabled && <p className="break-words text-sm">{t('Folder: ', '文件夹：', 'Folder: ')}{status.folder.folder}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={choose} disabled={busy || !ready} className={button}>{status.folder?.enabled ? t('Change folder', '更换文件夹', 'Tukar folder') : t('Choose save folder', '选择保存文件夹', 'Pilih folder simpanan')}</button>
        {status.folder?.enabled && <>
          <button type="button" onClick={() => window.dispatchEvent(new Event(AUTO_EXPORT_EVENT))} disabled={busy || status.state === 'saving'} className={button}>{t('Save / retry now', '立即保存／重试', 'Simpan / cuba semula')}</button>
          <button type="button" onClick={stop} disabled={busy} className={button}>{t('Pause auto save', '暂停自动保存', 'Jeda simpanan automatik')}</button>
        </>}
      </div>
      <p aria-live="polite" className="text-sm text-zinc-400">{status.state === 'saving' ? t('Saving reports…', '正在保存报表…', 'Menyimpan laporan…') : status.state === 'disabled' ? t('Automatic saving is off.', '自动保存尚未启用。', 'Simpanan automatik dimatikan.') : status.lastSavedAt ? t('Last saved: ', '上次保存：', 'Terakhir disimpan: ') + new Date(status.lastSavedAt).toLocaleString(language === 'zh' ? 'zh-MY' : language === 'ms' ? 'ms-MY' : 'en-MY') : t('Waiting for the first save.', '等待首次保存。', 'Menunggu simpanan pertama.')}</p>
      {status.error != null && <p role="alert" className="text-sm text-amber-300">{fileErrorMessage(status.error, language)}</p>}
    </div> : <p className="text-sm text-zinc-400">{t('Automatic folder saving is available in the Android app. Browser downloads remain manual.', '自动保存到文件夹需在 Android App 内使用；浏览器可手动下载。', 'Simpanan folder automatik tersedia dalam app Android. Muat turun pelayar dilakukan secara manual.')}</p>}
    {message && <p role="status" className="text-sm text-green-400">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {preview && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="restore-title">
      <div className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-zinc-600 bg-zinc-900 p-5">
        <h3 id="restore-title" className="text-xl font-bold">{t('Review backup', '核对备份', 'Semak sandaran')}</h3>
        <dl className="space-y-2 break-words text-sm">
          <div><dt className="text-zinc-400">{t('Shop', '店铺', 'Kedai')}</dt><dd>{preview.shopName}</dd></div>
          <div><dt className="text-zinc-400">{t('Backup date', '备份日期', 'Tarikh sandaran')}</dt><dd>{new Date(preview.createdAt).toLocaleString()}</dd></div>
          <div><dt className="text-zinc-400">{t('Orders / menu items', '订单／菜单商品', 'Pesanan / item menu')}</dt><dd>{preview.orderCount} / {preview.menuItemCount}</dd></div>
          <div><dt className="text-zinc-400">{t('Photos', '照片', 'Foto')}</dt><dd>{preview.photoCount}</dd></div>
          {preview.orderDateFrom && <div><dt className="text-zinc-400">{t('Order dates', '订单日期范围', 'Julat tarikh pesanan')}</dt><dd>{preview.orderDateFrom} → {preview.orderDateTo}</dd></div>}
        </dl>
        <p className="text-sm text-amber-300">{t('Restoring replaces the current records with this backup. Save a full backup of your current records first if you need to keep both.', '恢复会用这份备份替换当前资料。如需保留两份，请先保存当前资料的完整备份。', 'Pemulihan menggantikan rekod semasa dengan sandaran ini. Simpan sandaran penuh rekod semasa dahulu jika anda mahu menyimpan kedua-duanya.')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => setPreview(null)} className={button}>{t('Cancel', '取消', 'Batal')}</button>
          <button type="button" disabled={busy} onClick={backup} className={button}>{t('Back up current records', '先备份当前资料', 'Sandarkan rekod semasa')}</button>
          <button type="button" disabled={busy} onClick={restore} className={button + ' bg-primary text-black'}>{t('Confirm restore', '确认恢复', 'Sahkan pemulihan')}</button>
        </div>
      </div>
    </div>}
  </section>;
}
