import React, { useState } from 'react';
import { useStore } from '../store';
import { MenuItem } from '../types';
import { formatCurrency } from '../utils';
import { ArrowLeft, Plus, Globe, ReceiptText, UtensilsCrossed } from 'lucide-react';
import CustomizationModal from './CustomizationModal';

interface Props {
  onBack: () => void;
  onCheckout: () => void;
}

export default function CustomerHome({ onBack, onCheckout }: Props) {
  const { language, changeLanguage, settings, addToCart, cart } = useStore();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const toggleLanguage = () => {
    changeLanguage(language === 'en' ? 'zh' : 'en');
  };

  return (
    <div className="min-h-dvh bg-background-light dark:bg-background-dark flex flex-col">
      {/* Header */}
      <header className="pt-safe sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-black/90">
        <div className="flex items-center p-4 justify-between">
          <button
            type="button"
            onClick={onBack}
            aria-label={language === 'en' ? 'Back to product home' : '返回产品首页'}
            className="text-slate-900 dark:text-slate-100 flex w-11 h-11 items-center justify-center rounded-full hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" aria-hidden="true" />
          </button>
          <h1 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">
            {settings.shopNameEn} ({settings.shopNameZh})
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Image */}
        <div className="px-4 py-4">
          <img
            src={settings.coverPhoto}
            alt={`${settings.shopNameEn} menu cover`}
            className="h-[220px] w-full rounded-xl object-cover shadow-sm"
          />
        </div>

        {/* Menu Section */}
        <div className="px-4 pb-24">
          <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-tight pb-6 pt-2">
            {language === 'en' ? 'Menu' : '菜单'}
          </h2>
          
          <div className="space-y-6">
            {settings.menuItems.map(item => (
              <div 
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-surface-light p-3 dark:border-zinc-800 dark:bg-surface-dark"
              >
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-20 h-20 shrink-0 rounded-lg object-cover shadow-sm"
                />
                <div className="flex flex-col flex-1 justify-center">
                  <p className="text-slate-900 dark:text-slate-100 text-base font-bold leading-snug">
                    {item.name[language]}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-base font-semibold">
                    {formatCurrency(item.basePrice)}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  aria-label={`${language === 'en' ? 'Customize and add' : '选择选项并加入'} ${item.name[language]}`}
                  className="flex w-11 h-11 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg shadow-black/15 hover:bg-primary-hover active:scale-95 transition-all"
                >
                  <Plus className="w-6 h-6" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav aria-label="Customer navigation" className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-md items-center justify-between border-t border-zinc-200 bg-white px-6 pt-2 pb-safe dark:border-zinc-800 dark:bg-black">
        <button type="button" aria-current="page" className="flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-emphasis dark:text-primary">
          <UtensilsCrossed className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs font-semibold">{language === 'en' ? 'Menu' : '菜单'}</span>
        </button>
        <button type="button" onClick={onCheckout} className="relative flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-slate-500 transition-colors hover:text-emphasis dark:text-slate-300 dark:hover:text-primary">
          <span className="relative">
            <ReceiptText className="w-6 h-6" aria-hidden="true" />
            {cartCount > 0 && (
              <span className="absolute -right-3 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold leading-none text-on-primary" aria-label={`${cartCount} items in cart`}>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </span>
          <span className="text-xs font-semibold">{language === 'en' ? 'Cart' : '购物车'}</span>
        </button>
        <button type="button" onClick={toggleLanguage} aria-label="Switch language" className="flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-slate-500 transition-colors hover:text-emphasis dark:text-slate-300 dark:hover:text-primary">
          <Globe className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs font-semibold">EN/中文</span>
        </button>
      </nav>

      {/* Customization Modal */}
      {selectedItem && (
        <CustomizationModal 
          item={selectedItem}
          language={language}
          onClose={() => setSelectedItem(null)}
          onAdd={addToCart}
        />
      )}
    </div>
  );
}
