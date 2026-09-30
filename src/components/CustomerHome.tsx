import React, { useState } from 'react';
import { useStore } from '../store';
import { MenuItem } from '../types';
import { formatCurrency } from '../utils';
import { ArrowLeft, Plus, ReceiptText, UtensilsCrossed, ImageOff } from 'lucide-react';
import CustomizationModal from './CustomizationModal';
import { tr, localized } from '../i18n';
import LanguageSelector from './LanguageSelector';

interface Props {
  onBack: () => void;
  onCheckout: () => void;
}

export default function CustomerHome({ onBack, onCheckout }: Props) {
  const { language, changeLanguage, settings, addToCart, cart } = useStore();
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Upgrade only the exact shipped demo artwork; never rewrite saved custom covers.
  const legacyCover = `${import.meta.env.BASE_URL}assets/pos-hero-v2-black-yellow.png`;
  const demoCover = `${import.meta.env.BASE_URL}assets/pos-menu-cover-v3.webp`;
  const coverPhoto = settings.coverPhoto === legacyCover ? demoCover : settings.coverPhoto;
  const isIllustration = coverPhoto === demoCover;


  return (
    <div className="pos-workspace min-h-dvh bg-background-light dark:bg-background-dark flex flex-col">
      {/* Header */}
      <header className="pt-safe sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-black/90">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <h1 className="break-words text-lg font-bold text-slate-900 dark:text-white">{localized({ en: settings.shopNameEn, zh: settings.shopNameZh, ms: settings.shopNameMs }, language)}</h1>
            <button type="button" onClick={onBack} className="mt-1 inline-flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 px-3 font-semibold text-slate-700 dark:border-zinc-700 dark:text-slate-100">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />{t('Staff view', '店员接手', 'Paparan kakitangan')}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-600 dark:text-slate-300">{t('Customer View', '顾客模式', 'Paparan pelanggan')}</span>
            <LanguageSelector language={language} onChange={changeLanguage} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Image */}
        <div className="px-4 py-4">
          <img
            src={coverPhoto}
            alt={isIllustration ? t('Food illustration', '食物示意图', 'Ilustrasi makanan') : t('Menu cover', '菜单封面', 'Gambar muka menu')}
            className="h-32 w-full rounded-2xl object-cover md:h-40"
            width="1536" height="1024"
          />
          {isIllustration && <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{t('AI food illustration, not actual product photography.', 'AI 食物示意图，非实际出品照片。', 'Ilustrasi makanan AI, bukan foto produk sebenar.')}</p>}
        </div>

        {/* Menu Section */}
        <div className="px-4 pb-24">
          <h2 className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-tight tracking-tight pb-5 pt-2">
            {t('Menu', '菜单', 'Menu')}
          </h2>
          
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {settings.menuItems.map(item => (
              <div 
                key={item.id}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-zinc-200 bg-surface-light p-4 dark:border-zinc-800 dark:bg-surface-dark"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-16 h-16 shrink-0 rounded-lg object-cover shadow-sm sm:h-20 sm:w-20"
                  />
                ) : (
                  <div aria-hidden="true" className="grid aspect-square h-16 w-16 shrink-0 place-items-center rounded-lg bg-primary/10 text-emphasis dark:text-primary sm:h-20 sm:w-20">
                    <ImageOff className="h-7 w-7" />
                  </div>
                )}
                <div className="flex min-w-0 flex-col flex-1 justify-center">
                  <p className="text-slate-900 dark:text-slate-100 text-base font-bold leading-snug">
                    {localized(item.name, language)}
                  </p>
                  <p className="mt-2 text-emphasis dark:text-primary text-base font-bold tabular-nums">
                    {formatCurrency(item.basePrice)}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  aria-label={`${t('Customize and add', '选择选项并加入', 'Pilih pilihan dan tambah')} ${localized(item.name, language)}`}
                  className="col-span-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 font-bold text-on-primary shadow-lg shadow-black/15 hover:bg-primary-hover active:scale-95 transition-all"
                >
                  <Plus className="w-6 h-6" aria-hidden="true" />
                  {t('Add to order', '加入订单', 'Tambah pesanan')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav aria-label={t("Customer navigation", "顾客导航", "Navigasi pelanggan")} className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-6xl items-center justify-evenly border-t border-zinc-200 bg-white px-6 pt-2 pb-safe dark:border-zinc-800 dark:bg-black">
        <button type="button" aria-current="page" className="flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-emphasis dark:text-primary">
          <UtensilsCrossed className="w-6 h-6" aria-hidden="true" />
          <span className="text-sm font-semibold">{t('Menu', '菜单', 'Menu')}</span>
        </button>
        <button type="button" onClick={onCheckout} className="relative flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-slate-500 transition-colors hover:text-emphasis dark:text-slate-300 dark:hover:text-primary">
          <span className="relative">
            <ReceiptText className="w-6 h-6" aria-hidden="true" />
            {cartCount > 0 && (
              <span className="absolute -right-3 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold leading-none text-on-primary" aria-label={t(`${cartCount} items in cart`, `购物车共${cartCount}件`, `${cartCount} item dalam troli`)}>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </span>
          <span className="text-xs font-semibold">{t('Review order', '查看订单', 'Semak pesanan')}</span>
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
