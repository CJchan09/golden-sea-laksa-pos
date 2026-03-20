import React, { useState } from 'react';
import { MenuItem, SizeOption, NoodleOption, AddOnOption, Language, CartItem } from '../types';
import { SIZES, NOODLE_BASES, ADD_ONS } from '../constants';
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
  const [size, setSize] = useState<SizeOption>('Small');
  const [noodleBases, setNoodleBases] = useState<NoodleOption[]>([]);
  const [addOns, setAddOns] = useState<AddOnOption[]>([]);
  const [quantity, setQuantity] = useState(1);

  const handleNoodleToggle = (noodle: NoodleOption) => {
    if (noodleBases.includes(noodle)) {
      setNoodleBases(noodleBases.filter(n => n !== noodle));
    } else {
      if (noodleBases.length < 2) {
        setNoodleBases([...noodleBases, noodle]);
      }
    }
  };

  const handleAddOnToggle = (addon: AddOnOption) => {
    if (addOns.includes(addon)) {
      setAddOns(addOns.filter(a => a !== addon));
    } else {
      setAddOns([...addOns, addon]);
    }
  };

  const calculateTotal = () => {
    let total = item.basePrice;
    const sizePrice = SIZES.find(s => s.id === size)?.price || 0;
    total += sizePrice;
    
    const addOnPrice = addOns.reduce((sum, a) => {
      return sum + (ADD_ONS.find(ao => ao.id === a)?.price || 0);
    }, 0);
    total += addOnPrice;

    return total * quantity;
  };

  const isNoodleDisabled = (noodle: NoodleOption) => {
    return noodleBases.length >= 2 && !noodleBases.includes(noodle);
  };

  const handleAddToCart = () => {
    if (noodleBases.length === 0) {
      alert(language === 'en' ? 'Please select at least one noodle base.' : '请选择至少一种面条。');
      return;
    }

    onAdd({
      menuItemId: item.id,
      size,
      noodleBases,
      addOns,
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
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4"
      >
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative flex h-auto max-h-[90vh] w-full max-w-lg flex-col bg-background-light dark:bg-background-dark rounded-t-xl sm:rounded-xl overflow-hidden shadow-2xl"
        >
          {/* Handle for mobile */}
          <div className="flex h-6 w-full items-center justify-center sm:hidden absolute top-0 z-20">
            <div className="h-1.5 w-12 rounded-full bg-white/50"></div>
          </div>

          {/* Header Image & Close */}
          <div className="relative h-48 w-full shrink-0">
            <img 
              src={item.image} 
              alt={item.name[language]} 
              className="h-full w-full object-cover"
            />
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/80 dark:bg-background-dark/80 backdrop-blur-md text-slate-900 dark:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-tight tracking-tight">
                  {item.name[language]}
                </h2>
                <p className="text-primary font-semibold mt-1">
                  From {formatCurrency(item.basePrice)}
                </p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
              Authentic rich coconut curry broth served with fresh cockles, tofu puffs, and bean sprouts.
            </p>

            {/* Size Selection */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-900 dark:text-slate-100 text-lg font-bold">Size</h3>
                <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full">Required</span>
              </div>
              <div className="flex flex-col gap-3">
                {SIZES.map(s => (
                  <label 
                    key={s.id}
                    className={`group flex items-center gap-4 rounded-xl border-2 p-4 transition-all cursor-pointer ${
                      size === s.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-primary/10 dark:border-primary/5 hover:border-primary/30'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="size-selection" 
                      checked={size === s.id}
                      onChange={() => setSize(s.id)}
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
                {NOODLE_BASES.map(n => {
                  const disabled = isNoodleDisabled(n.id);
                  const checked = noodleBases.includes(n.id);
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
                {ADD_ONS.map(a => {
                  const checked = addOns.includes(a.id);
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
          <div className="p-6 border-t border-primary/5 bg-background-light dark:bg-background-dark shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center bg-primary/10 rounded-full p-1 h-12">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-primary/20 transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="w-8 text-center font-bold text-slate-900 dark:text-slate-100">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-primary/20 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <button 
                onClick={handleAddToCart}
                className="flex-1 h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-full transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
              >
                <span>Add to Order</span>
                <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                <span>{formatCurrency(calculateTotal())}</span>
              </button>
            </div>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

