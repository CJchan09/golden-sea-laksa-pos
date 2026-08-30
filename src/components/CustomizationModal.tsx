import React, { useEffect, useId, useRef, useState } from 'react';
import { MenuItem, Language, CartItem } from '../types';
import { formatCurrency } from '../utils';
import { X, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  item: MenuItem;
  language: Language;
  onClose: () => void;
  onAdd: (item: Omit<CartItem, 'id'>) => void;
}

export default function CustomizationModal({ item, language, onClose, onAdd }: Props) {
  const [sizeId, setSizeId] = useState<string>(item.sizes[0]?.id || '');
  const [noodleBaseIds, setNoodleBaseIds] = useState<string[]>([]);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const handleNoodleToggle = (noodleId: string) => {
    setValidationError('');
    if (noodleBaseIds.includes(noodleId)) {
      setNoodleBaseIds(noodleBaseIds.filter(n => n !== noodleId));
    } else {
      if (noodleBaseIds.length < 2) {
        setNoodleBaseIds([...noodleBaseIds, noodleId]);
      }
    }
  };

  const handleAddOnToggle = (addonId: string) => {
    if (addOnIds.includes(addonId)) {
      setAddOnIds(addOnIds.filter(a => a !== addonId));
    } else {
      setAddOnIds([...addOnIds, addonId]);
    }
  };

  const calculateTotal = () => {
    let total = item.basePrice;
    const sizePrice = item.sizes.find(s => s.id === sizeId)?.price || 0;
    total += sizePrice;
    
    const addOnPrice = addOnIds.reduce((sum, a) => {
      return sum + (item.addOns.find(ao => ao.id === a)?.price || 0);
    }, 0);
    total += addOnPrice;

    return total * quantity;
  };

  const isNoodleDisabled = (noodleId: string) => {
    return noodleBaseIds.length >= 2 && !noodleBaseIds.includes(noodleId);
  };

  const handleAddToCart = () => {
    if (item.noodleBases.length > 0 && noodleBaseIds.length === 0) {
      setValidationError(language === 'en' ? 'Please select at least one noodle base.' : '请选择至少一种面条。');
      return;
    }

    onAdd({
      menuItemId: item.id,
      sizeId,
      noodleBaseIds,
      addOnIds,
      quantity,
      unitPrice: calculateTotal() / quantity,
      totalPrice: calculateTotal()
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative flex h-auto max-h-[96dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl bg-background-light shadow-2xl dark:bg-background-dark sm:max-h-[90vh] sm:rounded-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {/* Handle for mobile */}
          <div className="flex h-6 w-full items-center justify-center sm:hidden absolute top-0 z-20">
            <div className="h-1.5 w-12 rounded-full bg-white/50"></div>
          </div>

          {/* Header Image & Close */}
          <div className="relative h-40 w-full shrink-0 sm:h-48">
            <img 
              src={item.image} 
              alt={item.name[language]} 
              className="h-full w-full object-cover"
            />
            <button 
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={language === 'en' ? 'Close item options' : '关闭商品选项'}
              className="absolute top-4 right-4 h-11 w-11 flex items-center justify-center rounded-full bg-white/90 dark:bg-background-dark/90 backdrop-blur-md text-slate-900 dark:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 id={titleId} className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-tight tracking-tight">
                  {item.name[language]}
                </h2>
                <p className="text-emphasis font-semibold mt-1 dark:text-primary">
                  From {formatCurrency(item.basePrice)}
                </p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
              {language === 'en'
                ? 'Choose the serving size, base, and optional add-ons for this item.'
                : '请选择这份餐点的份量、主食和可选加料。'}
            </p>

            {validationError && (
              <p role="alert" className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {validationError}
              </p>
            )}

            {/* Size Selection */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-900 dark:text-slate-100 text-lg font-bold">Size</h3>
                <span className="text-xs font-medium px-2 py-1 bg-primary/15 text-emphasis dark:text-primary rounded-full">Required</span>
              </div>
              <div className="flex flex-col gap-3">
                {item.sizes?.map(s => (
                  <label 
                    key={s.id}
                    className={`group flex items-center gap-4 rounded-xl border-2 p-4 transition-all cursor-pointer ${
                      sizeId === s.id
                        ? 'border-primary bg-primary/5' 
                        : 'border-primary/10 dark:border-primary/5 hover:border-primary/30'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="size-selection" 
                      checked={sizeId === s.id}
                      onChange={() => setSizeId(s.id)}
                      className="h-5 w-5 border-2 border-primary/30 bg-transparent text-primary focus:ring-primary focus:ring-offset-0"
                    />
                    <div className="flex grow flex-col">
                      <span className="text-slate-900 dark:text-slate-100 font-semibold">{s.name[language]}</span>
                      <span className="text-slate-500 dark:text-slate-400 text-sm italic">
                        {s.id === 'Small' ? 'Standard serving' : 'Extra noodles & toppings'}
                      </span>
                    </div>
                    <span className="text-slate-900 dark:text-slate-100 font-medium">
                      +{formatCurrency(s.price)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Noodle Base Selection */}
            <div className="mb-6">
              <div className="flex flex-col mb-4">
                <h3 className="text-slate-900 dark:text-slate-100 text-lg font-bold">Noodle Base</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Select up to 2 for 'Cham' (Mix)</p>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {item.noodleBases?.map(n => {
                  const disabled = isNoodleDisabled(n.id);
                  const checked = noodleBaseIds.includes(n.id);
                  return (
                    <label 
                      key={n.id}
                      className={`flex items-center justify-between py-3 border-b border-primary/5 ${
                        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{n.name[language]}</span>
                      <input 
                        type="checkbox" 
                        checked={checked}
                        disabled={disabled}
                        onChange={() => handleNoodleToggle(n.id)}
                        className="h-6 w-6 rounded-lg border-primary/20 text-primary focus:ring-primary focus:ring-offset-0 transition-colors"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Add-ons Selection */}
            <div className="mb-6">
              <div className="flex flex-col mb-4">
                <h3 className="text-slate-900 dark:text-slate-100 text-lg font-bold">Add-ons</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Optional</p>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {item.addOns?.map(a => {
                  const checked = addOnIds.includes(a.id);
                  return (
                    <label 
                      key={a.id}
                      className="flex items-center justify-between py-3 border-b border-primary/5 cursor-pointer"
                    >
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{a.name[language]}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 dark:text-slate-400 text-sm">+{formatCurrency(a.price)}</span>
                        <input 
                          type="checkbox" 
                          checked={checked}
                          onChange={() => handleAddOnToggle(a.id)}
                          className="h-6 w-6 rounded-lg border-primary/20 text-primary focus:ring-primary focus:ring-offset-0 transition-colors"
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Sticky Footer Action */}
          <div className="shrink-0 border-t border-zinc-200 bg-background-light p-4 dark:border-zinc-800 dark:bg-background-dark sm:p-6">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center bg-primary/10 rounded-full p-1 h-12">
                <button 
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label={language === 'en' ? 'Decrease quantity' : '减少数量'}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-emphasis hover:bg-primary/20 transition-colors dark:text-primary"
                >
                  <Minus aria-hidden="true" className="w-5 h-5" />
                </button>
                <span className="w-8 text-center font-bold text-slate-900 dark:text-slate-100">{quantity}</span>
                <button 
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label={language === 'en' ? 'Increase quantity' : '增加数量'}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-emphasis hover:bg-primary/20 transition-colors dark:text-primary"
                >
                  <Plus aria-hidden="true" className="w-5 h-5" />
                </button>
              </div>
              
              <button 
                type="button"
                onClick={handleAddToCart}
                className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 text-sm font-bold text-on-primary shadow-lg shadow-black/15 transition-colors hover:bg-primary-hover min-[360px]:text-base"
              >
                <span className="hidden min-[360px]:inline">Add to Order</span>
                <span className="min-[360px]:hidden">Add</span>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-black/30"></span>
                <span>{formatCurrency(calculateTotal())}</span>
              </button>
            </div>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
