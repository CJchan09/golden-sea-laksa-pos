import React, { useState } from 'react';
import { useStore } from '../store';
import { MENU_ITEMS } from '../constants';
import { MenuItem } from '../types';
import { formatCurrency } from '../utils';
import { ArrowLeft, Plus, Globe, ReceiptText, UtensilsCrossed } from 'lucide-react';
import CustomizationModal from './CustomizationModal';

interface Props {
  onBack: () => void;
  onCheckout: () => void;
}

export default function CustomerHome({ onBack, onCheckout }: Props) {
  const { language, changeLanguage } = useStore();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const { addToCart } = useStore();

  const toggleLanguage = () => {
    changeLanguage(language === 'en' ? 'zh' : 'en');
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-zinc-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-primary/10">
        <div className="flex items-center p-4 justify-between">
          <button onClick={onBack} className="text-slate-900 dark:text-slate-100 flex w-10 h-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">
            Golden Sea Laksa (金海叻沙)
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Image */}
        <div className="px-4 py-4">
          <div 
            className="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end overflow-hidden rounded-xl min-h-[220px] shadow-sm"
            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBLpY31sWcld75ZaPcZdrr5IY6qNh-odw0y5V6bmD9FQcBX0q-CCQc-p_rrV6LwJh4Cep-vT3H1uBEybd_Wue0BT2TCgvBEM8JU1MxZNJAHfWFLdQeteCqwxWtGeiYG63E6CnGuKBrSG6pfitXeXeBXONtNJLYMLZmr1WkYob-uOuiV0Nj9OJhL1eIivvwq28VZrujyFZPRqP1NUT8rlvqQWq0OhFXl0dsMPDwx9HkRLd7mYlb-hUWV9WwHFxwEuvogo9yWLNN2un7f")' }}
          />
        </div>

        {/* Menu Section */}
        <div className="px-4 pb-24">
          <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-tight pb-6 pt-2">
            Our Core Menu
          </h2>
          
          <div className="space-y-6">
            {MENU_ITEMS.map(item => (
              <div 
                key={item.id}
                className="flex items-center gap-4 bg-background-light/50 dark:bg-zinc-800/50 p-3 rounded-xl border border-primary/5"
              >
                <div 
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg w-20 h-20 shrink-0 shadow-sm"
                  style={{ backgroundImage: `url("${item.image}")` }}
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
                  onClick={() => setSelectedItem(item)}
                  className="flex w-10 h-10 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-transform"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-primary/10 px-6 pb-6 pt-3 flex justify-between items-center z-30">
        <button className="flex flex-col items-center gap-1 text-primary">
          <UtensilsCrossed className="w-6 h-6" />
          <span className="text-xs font-semibold">Menu</span>
        </button>
        <button onClick={onCheckout} className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors">
          <ReceiptText className="w-6 h-6" />
          <span className="text-xs font-semibold">Orders</span>
        </button>
        <button onClick={toggleLanguage} className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors">
          <Globe className="w-6 h-6" />
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

