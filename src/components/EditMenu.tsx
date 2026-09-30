import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { MenuItem } from '../types';
import type { OptionGroup } from '../data/app-schema';
import { getMenuOptionGroups } from '../domain/menu-options';
import { Plus, Trash2, Save, Image as ImageIcon, QrCode, Upload, X, Store, CheckCircle2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import MenuOptionManager from './MenuOptionManager';
import { tr, localized, orderTypeLabel } from '../i18n';
import { LocalizedNameEditor } from './LanguageSelector';
import type { OrderType } from '../types';

export default function EditMenu({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const { language, settings, updateSettings, ready, storageError } = useStore();

  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const [shopNameMs, setShopNameMs] = useState(settings.shopNameMs ?? '');
  const [defaultOrderType, setDefaultOrderType] = useState<OrderType>(settings.defaultOrderType ?? 'Dine-in');
  const [saving, setSaving] = useState(false);
  const [applySavedSettings, setApplySavedSettings] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveLock = useRef(false);
  const [shopNameEn, setShopNameEn] = useState(settings.shopNameEn);
  const [shopNameZh, setShopNameZh] = useState(settings.shopNameZh);
  const [coverPhoto, setCoverPhoto] = useState(settings.coverPhoto);
  const [qrPreview, setQrPreview] = useState<string | null>(settings.qrImage);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(JSON.parse(JSON.stringify(settings.menuItems)));
  
  const [enableTax, setEnableTax] = useState(settings.enableTax);
  const [taxRate, setTaxRate] = useState(settings.taxRate);
  const [takeawayFee, setTakeawayFee] = useState(settings.takeawayFee);
  const [saveMessage, setSaveMessage] = useState('');

  const qrInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const menuEditorRef = useRef<HTMLElement>(null);
  const saveMessageTimerRef = useRef<number | null>(null);

  const draft = { ...settings, shopNameEn, shopNameZh, shopNameMs, defaultOrderType, coverPhoto, qrImage: qrPreview, menuItems, enableTax, taxRate, takeawayFee };
  const dirty = JSON.stringify(draft) !== JSON.stringify({ ...settings, shopNameMs: settings.shopNameMs ?? '', defaultOrderType: settings.defaultOrderType ?? 'Dine-in' });
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const saveButtonLabel = saving ? t('Saving…', '保存中…', 'Menyimpan…') : t('Save settings', '保存设置', 'Simpan tetapan');

  useEffect(() => {
    return () => {
      if (saveMessageTimerRef.current !== null) {
        window.clearTimeout(saveMessageTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (dirtyRef.current && !applySavedSettings) return;
    setShopNameMs(settings.shopNameMs ?? '');
    setDefaultOrderType(settings.defaultOrderType ?? 'Dine-in');
    setShopNameEn(settings.shopNameEn);
    setShopNameZh(settings.shopNameZh);
    setCoverPhoto(settings.coverPhoto);
    setQrPreview(settings.qrImage);
    setMenuItems(JSON.parse(JSON.stringify(settings.menuItems)));
    setEnableTax(settings.enableTax);
    setTaxRate(settings.taxRate);
    setTakeawayFee(settings.takeawayFee);
    if (applySavedSettings) setApplySavedSettings(false);
  }, [settings, applySavedSettings]);
  
  const handleSave = async () => {
    if (saveLock.current || !ready) return;
    setSaveError(''); setSaveMessage('');
    if (!localized({ en: shopNameEn, zh: shopNameZh, ms: shopNameMs }, language) || menuItems.some(item => !localized(item.name, language))) {
      setSaveError(t('Every shop and item needs a name in at least one language.', '店名和每个商品都需要至少一种语言的名称。', 'Kedai dan setiap item memerlukan nama dalam sekurang-kurangnya satu bahasa.')); return;
    }
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 || !Number.isFinite(takeawayFee) || takeawayFee < 0 || menuItems.some(item => !Number.isFinite(item.basePrice) || item.basePrice < 0)) {
      setSaveError(t('Check prices, takeaway fee and tax rate.', '请检查价格、打包费和税率。', 'Semak harga, caj bungkus dan kadar cukai.')); return;
    }
    saveLock.current = true; setSaving(true);
    try {
      const saved = await updateSettings(draft);
      if (!saved) { setSaveError(t('Save failed. Your draft is still here. Please retry.', '保存失败，草稿仍保留，请重试。', 'Gagal disimpan. Draf masih ada. Sila cuba lagi.')); return; }
      setApplySavedSettings(true);
      setSaveMessage(t('Saved on this device.', '已保存到本机。', 'Disimpan pada peranti ini.'));
      if (saveMessageTimerRef.current !== null) window.clearTimeout(saveMessageTimerRef.current);
      saveMessageTimerRef.current = window.setTimeout(() => setSaveMessage(''), 3000);
    } catch {
      setSaveError(t('Save failed. Your draft is still here. Please retry.', '保存失败，草稿仍保留，请重试。', 'Gagal disimpan. Draf masih ada. Sila cuba lagi.'));
    } finally { saveLock.current = false; setSaving(false); }
  };

  const handleAddMenuItem = () => {
    const newItem: MenuItem = {
      id: uuidv4(),
      name: { en: '', zh: '', ms: '' },
      basePrice: 0.00,
      image: '',
      sizes: [],
      noodleBases: [],
      addOns: [],
      optionGroups: [],
    };
    setMenuItems((currentItems) => [newItem, ...currentItems]);
  };

  const handleOptionGroupsUpdate = (menuId: string, optionGroups: OptionGroup[]) => {
    setMenuItems((currentItems) => currentItems.map((item) => (
      item.id === menuId ? { ...item, optionGroups } : item
    )));
  };

  const handleUpdateMenuItem = (id: string, field: string, value: string | number) => {
    setMenuItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'nameEn') return { ...item, name: { ...item.name, en: value as string } };
      if (field === 'nameZh') return { ...item, name: { ...item.name, zh: value as string } };
      if (field === 'nameMs') return { ...item, name: { ...item.name, ms: value as string } };
      return { ...item, [field]: value };
    }));
  };

  const handleRemoveMenuItem = (id: string) => {
    if (window.confirm(t('Delete this item from your menu draft?', '从菜单草稿删除这个商品？', 'Padam item ini daripada draf menu?'))) {
      setMenuItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'qr' | 'cover' | 'menu', menuId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onerror = () => setSaveError(t('Could not read the image.', '无法读取图片。', 'Gagal membaca imej.'));
    reader.onload = () => {
      const base64 = reader.result as string;
      if (type === 'qr') setQrPreview(base64);
      else if (type === 'cover') setCoverPhoto(base64);
      else if (type === 'menu' && menuId) handleUpdateMenuItem(menuId, 'image', base64);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      <p role="status" className="text-sm font-semibold text-amber-700 dark:text-amber-300">{dirty ? t("Unsaved changes", "有未保存的更改", "Perubahan belum disimpan") : ""}</p>
      {(saveError || storageError) && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{saveError || t("Device storage failed. Please retry.", "本机保存失败，请重试。", "Storan peranti gagal. Sila cuba lagi.")}</p>}
      {saveMessage && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white shadow-2xl dark:bg-white dark:text-zinc-950"
        >
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-primary" />
          {saveMessage}
        </div>
      )}


      <fieldset disabled={saving} className="contents">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
            <Store className="w-6 h-6 text-emphasis dark:text-primary" />
            {t("Store settings", "门店设置", "Tetapan kedai")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("Configure your menu, shop name, and payment QR.", "管理菜单、店名和收款二维码。", "Urus menu, nama kedai dan QR pembayaran.")}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !ready}
            className="min-h-12 flex w-full items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-on-primary font-bold py-3 px-6 rounded-xl transition-all shadow-sm active:scale-[0.98] sm:w-auto"
          >
            <Save aria-hidden="true" className="w-5 h-5" />
            {saveButtonLabel}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Settings */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t("Basic settings", "基本设置", "Tetapan asas")}</h3>
          
          <LocalizedNameEditor language={language} label={t('Shop name', '店名', 'Nama kedai')}
            value={{ en: shopNameEn, zh: shopNameZh, ms: shopNameMs }}
            onChange={names => { setShopNameEn(names.en ?? ''); setShopNameZh(names.zh ?? ''); setShopNameMs(names.ms ?? ''); }} />
          <label className="block space-y-2"><span className="text-sm font-bold">{t('Default order type', '默认点单方式', 'Jenis pesanan lalai')}</span>
            <select className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" value={defaultOrderType} onChange={event => setDefaultOrderType(event.target.value as OrderType)}>
              <option value="Takeaway">{orderTypeLabel(language, 'Takeaway')}</option>
              <option value="Dine-in">{orderTypeLabel(language, 'Dine-in')}</option>
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={enableTax}
                  onChange={e => setEnableTax(e.target.checked)}
                  className="w-5 h-5 accent-primary rounded bg-gray-100 border-gray-300 focus:ring-emphasis dark:focus:ring-primary dark:bg-zinc-800 dark:border-zinc-600"
                />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t("Enable tax", "启用税费", "Aktifkan cukai")}</span>
              </label>
              {enableTax && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-24 min-h-12 bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-emphasis dark:focus:border-primary rounded-xl px-3 py-2 outline-none font-medium dark:text-white transition-colors"
                  />
                  <span className="text-gray-500 font-bold">%</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t("Takeaway fee per order (RM)", "每单打包费 (RM)", "Caj bungkus setiap pesanan (RM)")}</label>
              <input
                type="number"
                step="0.10"
                value={takeawayFee}
                onChange={e => setTakeawayFee(parseFloat(e.target.value) || 0)}
                className="w-full min-h-11 bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-emphasis dark:focus:border-primary rounded-xl px-4 py-2.5 outline-none font-medium dark:text-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 mt-4">{t('Customer menu cover', '顾客菜单封面', 'Gambar muka menu pelanggan')}</label>
            {coverPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700">
                <img src={coverPhoto} alt={t('Menu cover', '菜单封面', 'Gambar muka menu')} className="w-full h-32 object-cover" />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-100 transition-opacity"
                >
                  <span className="text-white font-bold flex items-center gap-2"><Upload className="w-4 h-4"/> {t('Change cover', '更换封面', 'Tukar gambar muka')}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-emphasis hover:text-emphasis dark:hover:border-primary dark:hover:text-primary transition-colors"
              >
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="font-bold text-sm">{t("Choose cover image", "选择封面图片", "Pilih gambar muka")}</span>
              </button>
            )}
            <input type="file" ref={coverInputRef} accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'cover')} />
          </div>
        </section>

        {/* QR Payment Settings */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-500" />
            {t("Payment QR", "收款二维码", "QR pembayaran")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("Shown during QR payment. Staff must confirm that the money was received.", "扫码付款时显示，由店员确认款项已经到账。", "Dipaparkan semasa bayaran QR. Kakitangan mesti mengesahkan wang diterima.")}</p>
          
          <div className="pt-2">
            {qrPreview ? (
              <div className="relative bg-gray-50 dark:bg-zinc-950 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                <img src={qrPreview} alt={t('Payment QR code', '收款二维码', 'Kod QR pembayaran')} className="w-full max-h-48 object-contain mx-auto rounded-lg" />
                <button
                  type="button"
                  onClick={() => setQrPreview(null)}
                  className="absolute top-2 right-2 min-h-11 min-w-11 flex items-center justify-center bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors shadow-md"
                  title={t("Remove QR image", "移除二维码", "Buang imej QR")}
                  aria-label={t('Remove QR code', '移除收款二维码', 'Buang kod QR')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => qrInputRef.current?.click()}
                className="w-full h-48 border-2 border-dashed border-blue-200 dark:border-blue-900/50 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl flex flex-col items-center justify-center text-blue-500 transition-colors bg-blue-50/50 dark:bg-blue-900/10"
              >
                <Upload className="w-10 h-10 mb-3" />
                <span className="font-bold">{t("Choose QR image", "选择二维码图片", "Pilih imej QR")}</span>
                <span className="text-sm text-blue-400 mt-1">{t("Use your bank or e-wallet QR", "使用银行或电子钱包的收款二维码", "Gunakan QR bank atau e-dompet anda")}</span>
              </button>
            )}
            <input type="file" ref={qrInputRef} accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'qr')} />
          </div>
        </section>
      </div>

      {/* Menu Management */}
      <section ref={menuEditorRef} className="scroll-mt-24 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {t("Menu items", "菜单管理", "Item menu")}
          </h3>
          <button
            type="button"
            onClick={handleAddMenuItem}
            className="min-h-11 flex items-center gap-2 text-on-primary bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg font-bold transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> {t("Add item", "新增商品", "Tambah item")}
          </button>
        </div>

        <div className="space-y-4">
          {menuItems.map((item, index) => (
            <div key={item.id} className="flex flex-col sm:flex-row gap-4 p-4 border border-gray-100 dark:border-zinc-800 rounded-xl bg-gray-50/50 dark:bg-zinc-950/50">
              {/* Image Upload for Item */}
              <div className="shrink-0">
                {item.image ? (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 group">
                    <img src={item.image} alt={localized(item.name, language)} className="w-full h-full object-cover" />
                    <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer transition-opacity">
                      <ImageIcon className="w-6 h-6 text-white" />
                      <span className="sr-only">{t("Change item image", "更换商品图片", "Tukar gambar item")}</span>
                      <input aria-label={t("Change item image", "更换商品图片", "Tukar gambar item")} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'menu', item.id)} />
                    </label>
                  </div>
                ) : (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-700 flex items-center justify-center text-gray-400 hover:text-emphasis hover:border-emphasis dark:hover:text-primary dark:hover:border-primary cursor-pointer transition-colors bg-white dark:bg-zinc-900">
                    <ImageIcon className="w-8 h-8" />
                    <span className="sr-only">{t("Choose item image", "选择商品图片", "Pilih gambar item")}</span>
                    <input aria-label={t("Choose item image", "选择商品图片", "Pilih gambar item")} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'menu', item.id)} />
                  </label>
                )}
              </div>
              
              <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><LocalizedNameEditor language={language} label={t('Item name', '商品名称', 'Nama item')}
                  value={item.name} onChange={names => setMenuItems(current => current.map(candidate => candidate.id === item.id ? { ...candidate, name: { ...names, en: names.en ?? '', zh: names.zh ?? '' } } : candidate))} /></div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t("Base price (RM)", "基本价格 (RM)", "Harga asas (RM)")}</label>
                  <input
                    type="number"
                    step="0.10"
                    value={item.basePrice}
                    onChange={e => handleUpdateMenuItem(item.id, 'basePrice', parseFloat(e.target.value) || 0)}
                    className="w-full min-h-11 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 focus:border-emphasis dark:focus:border-primary rounded-lg px-3 py-2 outline-none text-sm dark:text-white"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveMenuItem(item.id)}
                    className="min-h-11 min-w-11 flex items-center justify-center text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/40 dark:hover:bg-red-950/70 rounded-lg transition-colors"
                    title={t("Delete item", "删除商品", "Padam item")}
                    aria-label={t(`Delete ${localized(item.name, language)}`, `删除 ${localized(item.name, language)}`, `Padam ${localized(item.name, language)}`)}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="col-span-1 mt-4 border-t border-gray-100 pt-4 dark:border-zinc-800 sm:col-span-2">
                  <MenuOptionManager
                    itemId={item.id}
                    itemName={localized(item.name, language) || t('New item', '新商品', 'Item baharu')}
                    groups={getMenuOptionGroups(item)}
                    onChange={(optionGroups) => handleOptionGroupsUpdate(item.id, optionGroups)}
                  />
                </div>
              </div>
            </div>
          ))}
          
          {menuItems.length === 0 && (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t("No items yet. Add your first item.", "还没有商品，先新增一个。", "Belum ada item. Tambah item pertama anda.")}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-gray-100 pt-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !ready}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-on-primary shadow-sm transition-colors hover:bg-primary-hover sm:w-auto"
          >
            <Save aria-hidden="true" className="h-5 w-5" />
            {saveButtonLabel}
          </button>
        </div>
      </section>
      </fieldset>
    </div>
  );
}
