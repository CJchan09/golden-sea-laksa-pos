import React, { useState, useRef } from 'react';
import { useStore } from '../store';
import { MenuItem } from '../types';
import { formatCurrency } from '../utils';
import { Plus, Trash2, Save, Image as ImageIcon, QrCode, Upload, X, ArrowLeft, Store } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function EditMenu() {
  const { language, settings, updateSettings } = useStore();
  
  const [shopNameEn, setShopNameEn] = useState(settings.shopNameEn);
  const [shopNameZh, setShopNameZh] = useState(settings.shopNameZh);
  const [coverPhoto, setCoverPhoto] = useState(settings.coverPhoto);
  const [qrPreview, setQrPreview] = useState<string | null>(settings.qrImage);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(JSON.parse(JSON.stringify(settings.menuItems)));
  
  const qrInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  const handleSave = () => {
    updateSettings({
      ...settings,
      shopNameEn,
      shopNameZh,
      coverPhoto,
      qrImage: qrPreview,
      menuItems
    });
    alert(language === 'en' ? 'Settings saved successfully!' : '设置保存成功！');
  };

  const handleAddMenuItem = () => {
    const newItem: MenuItem = {
      id: uuidv4(),
      name: { en: 'New Item', zh: '新商品' },
      basePrice: 0.00,
      image: ''
    };
    setMenuItems([...menuItems, newItem]);
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
      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-orange-100 dark:border-zinc-800">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Store className="w-6 h-6 text-orange-600" />
            Store Settings / 门店设置
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure your menu, shop name, and payment QR.</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98]"
        >
          <Save className="w-5 h-5" />
          Save Changes / 保存更改
        </button>
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
              className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-orange-500 rounded-xl px-4 py-2.5 outline-none font-medium dark:text-white transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Shop Name (ZH) / 中文店名</label>
            <input
              type="text"
              value={shopNameZh}
              onChange={e => setShopNameZh(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-orange-500 rounded-xl px-4 py-2.5 outline-none font-medium dark:text-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 mt-4">Cover Photo / 封面图 (Customer Page)</label>
            {coverPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700">
                <img src={coverPhoto} alt="Cover" className="w-full h-32 object-cover" />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                >
                  <span className="text-white font-bold flex items-center gap-2"><Upload className="w-4 h-4"/> Change Cover</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => coverInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-orange-500 hover:text-orange-500 transition-colors"
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
                  onClick={() => setQrPreview(null)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors shadow-md"
                  title="Remove QR Code"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
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
      <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Menu Items / 菜单管理
          </h3>
          <button
            onClick={handleAddMenuItem}
            className="flex items-center gap-2 text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 px-4 py-2 rounded-lg font-bold transition-colors text-sm"
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
                    <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <ImageIcon className="w-6 h-6 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'menu', item.id)} />
                    </label>
                  </div>
                ) : (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-700 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:border-orange-500 cursor-pointer transition-colors bg-white dark:bg-zinc-900">
                    <ImageIcon className="w-8 h-8" />
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'menu', item.id)} />
                  </label>
                )}
              </div>
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Name (EN) / 英文名</label>
                  <input
                    type="text"
                    value={item.name.en}
                    onChange={e => handleUpdateMenuItem(item.id, 'nameEn', e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 focus:border-orange-500 rounded-lg px-3 py-2 outline-none text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Name (ZH) / 中文名</label>
                  <input
                    type="text"
                    value={item.name.zh}
                    onChange={e => handleUpdateMenuItem(item.id, 'nameZh', e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 focus:border-orange-500 rounded-lg px-3 py-2 outline-none text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Price / 价格 (RM)</label>
                  <input
                    type="number"
                    step="0.10"
                    value={item.basePrice}
                    onChange={e => handleUpdateMenuItem(item.id, 'basePrice', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 focus:border-orange-500 rounded-lg px-3 py-2 outline-none text-sm dark:text-white"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <button
                    onClick={() => handleRemoveMenuItem(item.id)}
                    className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 p-2 rounded-lg transition-colors"
                    title="Delete Item"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
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
      </section>
    </div>
  );
}
