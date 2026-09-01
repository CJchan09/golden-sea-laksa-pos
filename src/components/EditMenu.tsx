import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { MenuItem } from '../types';
import type { OptionGroup } from '../data/app-schema';
import { getMenuOptionGroups } from '../domain/menu-options';
import { Plus, Trash2, Save, Image as ImageIcon, QrCode, Upload, X, Store, Info, ArrowDown, CheckCircle2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { IS_PUBLIC_DEMO } from '../demo-mode';
import MenuOptionManager from './MenuOptionManager';
import PublicDemoReset from './PublicDemoReset';

export default function EditMenu() {
  const { language, settings, updateSettings } = useStore();

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

  const saveButtonLabel = IS_PUBLIC_DEMO
    ? 'Save on this device / 仅保存本机'
    : 'Save Changes / 保存更改';

  useEffect(() => {
    return () => {
      if (saveMessageTimerRef.current !== null) {
        window.clearTimeout(saveMessageTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setShopNameEn(settings.shopNameEn);
    setShopNameZh(settings.shopNameZh);
    setCoverPhoto(settings.coverPhoto);
    setQrPreview(settings.qrImage);
    setMenuItems(JSON.parse(JSON.stringify(settings.menuItems)));
    setEnableTax(settings.enableTax);
    setTaxRate(settings.taxRate);
    setTakeawayFee(settings.takeawayFee);
  }, [settings]);
  
  const handleSave = () => {
    updateSettings({
      ...settings,
      shopNameEn,
      shopNameZh,
      coverPhoto,
      qrImage: qrPreview,
      menuItems,
      enableTax,
      taxRate,
      takeawayFee
    });
    setSaveMessage(IS_PUBLIC_DEMO
      ? (language === 'en' ? 'Saved on this device only.' : '已保存到这台设备。')
      : (language === 'en' ? 'Settings saved successfully!' : '设置保存成功！'));
    if (saveMessageTimerRef.current !== null) {
      window.clearTimeout(saveMessageTimerRef.current);
    }
    saveMessageTimerRef.current = window.setTimeout(() => {
      setSaveMessage('');
      saveMessageTimerRef.current = null;
    }, 3000);
  };

  const handleAddMenuItem = () => {
    const newItem: MenuItem = {
      id: uuidv4(),
      name: { en: 'New Item', zh: '新商品' },
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
      return { ...item, [field]: value };
    }));
  };

  const handleRemoveMenuItem = (id: string) => {
    if (window.confirm(language === 'en' ? 'Are you sure you want to delete this item?' : '确定要删除此商品吗？')) {
      setMenuItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'qr' | 'cover' | 'menu', menuId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === 'qr') setQrPreview(base64);
      else if (type === 'cover') setCoverPhoto(base64);
      else if (type === 'menu' && menuId) handleUpdateMenuItem(menuId, 'image', base64);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32">
      {saveMessage && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white shadow-2xl dark:bg-white dark:text-zinc-950"
        >
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-primary" />
          {saveMessage}
        </div>
      )}

      {IS_PUBLIC_DEMO && (
        <aside className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm leading-6 text-gray-800 dark:text-zinc-100">
          <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emphasis dark:text-primary" />
          <div className="flex-1">
            <p>
              <strong>Public demo / 公开测试：</strong>{' '}
              这台设备的浏览器有一份本机副本，同浏览器标签会共享。你可以新增商品，并为商品建立大小份、主食、肉类、加料等选项组；保存不会改到公开原版或其他设备的资料。
            </p>
            <button
              type="button"
              onClick={() => menuEditorRef.current?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                block: 'start',
              })}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-on-primary transition-colors hover:bg-primary-hover"
            >
              <ArrowDown aria-hidden="true" className="h-4 w-4" />
              Go to menu editor / 到菜单编辑
            </button>
          </div>
        </aside>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
            <Store className="w-6 h-6 text-emphasis dark:text-primary" />
            Store Settings / 门店设置
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure your menu, shop name, and payment QR.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <PublicDemoReset buttonClassName="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition-colors hover:border-red-400 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70 sm:w-auto" />
          <button
            type="button"
            onClick={handleSave}
            className="min-h-12 flex w-full items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-on-primary font-bold py-3 px-6 rounded-xl transition-all shadow-sm active:scale-[0.98] sm:w-auto"
          >
            <Save aria-hidden="true" className="w-5 h-5" />
            {saveButtonLabel}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Settings */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Basic Settings / 基本设置</h3>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Shop Name (EN) / 英文店名</label>
            <input
              type="text"
              value={shopNameEn}
              onChange={e => setShopNameEn(e.target.value)}
              className="w-full min-h-11 bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-emphasis dark:focus:border-primary rounded-xl px-4 py-2.5 outline-none font-medium dark:text-white transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Shop Name (ZH) / 中文店名</label>
            <input
              type="text"
              value={shopNameZh}
              onChange={e => setShopNameZh(e.target.value)}
              className="w-full min-h-11 bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-emphasis dark:focus:border-primary rounded-xl px-4 py-2.5 outline-none font-medium dark:text-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={enableTax}
                  onChange={e => setEnableTax(e.target.checked)}
                  className="w-5 h-5 accent-primary rounded bg-gray-100 border-gray-300 focus:ring-emphasis dark:focus:ring-primary dark:bg-zinc-800 dark:border-zinc-600"
                />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Enable Tax / 开启税务</span>
              </label>
              {enableTax && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-24 min-h-11 bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-emphasis dark:focus:border-primary rounded-xl px-3 py-2 outline-none font-medium dark:text-white transition-colors"
                  />
                  <span className="text-gray-500 font-bold">%</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Takeaway Fee (RM) / 打包费</label>
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
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 mt-4">Cover Photo / 封面图 (Customer Page)</label>
            {coverPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700">
                <img src={coverPhoto} alt="Cover" className="w-full h-32 object-cover" />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                >
                  <span className="text-white font-bold flex items-center gap-2"><Upload className="w-4 h-4"/> Change Cover</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-emphasis hover:text-emphasis dark:hover:border-primary dark:hover:text-primary transition-colors"
              >
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="font-bold text-sm">Upload Cover Photo</span>
              </button>
            )}
            <input type="file" ref={coverInputRef} accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'cover')} />
          </div>
        </section>

        {/* QR Payment Settings */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-500" />
            QR Payment Image / 收款二维码
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">This will be shown when customers select "QR Pay" on their checkout screen.</p>
          
          <div className="pt-2">
            {qrPreview ? (
              <div className="relative bg-gray-50 dark:bg-zinc-950 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                <img src={qrPreview} alt="QR Code" className="w-full max-h-48 object-contain mx-auto rounded-lg" />
                <button
                  type="button"
                  onClick={() => setQrPreview(null)}
                  className="absolute top-2 right-2 min-h-11 min-w-11 flex items-center justify-center bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors shadow-md"
                  title="Remove QR Code"
                  aria-label={language === 'en' ? 'Remove QR code' : '移除收款二维码'}
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
                <span className="font-bold">Upload QR Code</span>
                <span className="text-xs text-blue-400 mt-1">Upload your bank or e-wallet QR here</span>
              </button>
            )}
            <input type="file" ref={qrInputRef} accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'qr')} />
          </div>
        </section>
      </div>

      {/* Menu Management */}
      <section ref={menuEditorRef} className="scroll-mt-24 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Menu Items / 菜单管理
          </h3>
          <button
            type="button"
            onClick={handleAddMenuItem}
            className="min-h-11 flex items-center gap-2 text-on-primary bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg font-bold transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        <div className="space-y-4">
          {menuItems.map((item, index) => (
            <div key={item.id} className="flex flex-col sm:flex-row gap-4 p-4 border border-gray-100 dark:border-zinc-800 rounded-xl bg-gray-50/50 dark:bg-zinc-950/50">
              {/* Image Upload for Item */}
              <div className="shrink-0">
                {item.image ? (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 group">
                    <img src={item.image} alt="Menu" className="w-full h-full object-cover" />
                    <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer transition-opacity">
                      <ImageIcon className="w-6 h-6 text-white" />
                      <span className="sr-only">Change menu item image</span>
                      <input aria-label="Change menu item image" type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'menu', item.id)} />
                    </label>
                  </div>
                ) : (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-700 flex items-center justify-center text-gray-400 hover:text-emphasis hover:border-emphasis dark:hover:text-primary dark:hover:border-primary cursor-pointer transition-colors bg-white dark:bg-zinc-900">
                    <ImageIcon className="w-8 h-8" />
                    <span className="sr-only">Upload menu item image</span>
                    <input aria-label="Upload menu item image" type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'menu', item.id)} />
                  </label>
                )}
              </div>
              
              <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Name (EN) / 英文名</label>
                  <input
                    type="text"
                    value={item.name.en}
                    onChange={e => handleUpdateMenuItem(item.id, 'nameEn', e.target.value)}
                    className="w-full min-h-11 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 focus:border-emphasis dark:focus:border-primary rounded-lg px-3 py-2 outline-none text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Name (ZH) / 中文名</label>
                  <input
                    type="text"
                    value={item.name.zh}
                    onChange={e => handleUpdateMenuItem(item.id, 'nameZh', e.target.value)}
                    className="w-full min-h-11 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 focus:border-emphasis dark:focus:border-primary rounded-lg px-3 py-2 outline-none text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Price / 价格 (RM)</label>
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
                    title="Delete Item"
                    aria-label={`Delete ${item.name.en || 'menu item'}`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="col-span-1 mt-4 border-t border-gray-100 pt-4 dark:border-zinc-800 sm:col-span-2">
                  <MenuOptionManager
                    itemId={item.id}
                    itemName={item.name.en || item.name.zh || 'menu item'}
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
              <p>No menu items yet. Add one to get started!</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-gray-100 pt-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-on-primary shadow-sm transition-colors hover:bg-primary-hover sm:w-auto"
          >
            <Save aria-hidden="true" className="h-5 w-5" />
            {saveButtonLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
