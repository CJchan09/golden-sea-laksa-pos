import { useState, useRef } from 'react';
import { Minus, Plus, Trash2, Pencil } from 'lucide-react';
import { useStore } from '../store';
import { getCartItemDisplay } from '../domain/cart-item-display';
import { tr } from '../i18n';
import { formatCurrency } from '../utils';
import type { CartItem } from '../types';

export default function CartLines({ onEdit }: { onEdit: (item: CartItem) => void }) {
  const { cart, settings, language, removeFromCart, updateCartItem } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const mutate = async (operation: () => Promise<boolean>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError('');
    try { if (!await operation()) setError(tr(language,'Could not save your changes.','修改未能保存。','Perubahan tidak dapat disimpan.')); }
    catch { setError(tr(language,'Could not save your changes.','修改未能保存。','Perubahan tidak dapat disimpan.')); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="space-y-4">
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {!cart.length && <p className="py-8 text-center text-gray-500">{tr(language,'Cart is empty','购物车为空','Troli kosong')}</p>}
    {cart.map(item => {
      const menuItem = settings.menuItems.find(m => m.id === item.menuItemId);
      const display = getCartItemDisplay(item, menuItem, language);
      return <div key={item.id} className="border-b border-gray-200 pb-4 last:border-0 dark:border-zinc-700">
        <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 flex-1 font-bold break-words">{display.itemName}</h3><strong className="shrink-0">{formatCurrency(item.totalPrice)}</strong></div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 break-words">{display.details.join(' • ')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button disabled={busy || item.quantity <= 1} aria-label={tr(language,'Decrease quantity','减少数量','Kurangkan kuantiti')} onClick={() => mutate(() => updateCartItem(item.id,{ quantity: item.quantity - 1 }))} className="flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-gray-100 disabled:opacity-40 dark:bg-zinc-800"><Minus size={18}/></button>
          <span className="min-w-8 text-center font-bold">{item.quantity}</span>
          <button disabled={busy} aria-label={tr(language,'Increase quantity','增加数量','Tambah kuantiti')} onClick={() => mutate(() => updateCartItem(item.id,{ quantity: item.quantity + 1 }))} className="flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-zinc-800"><Plus size={18}/></button>
          {menuItem && <button disabled={busy} onClick={() => onEdit(item)} className="flex min-h-12 items-center gap-1 rounded-lg px-3 text-sm font-semibold"><Pencil size={16}/>{tr(language,'Edit','修改','Ubah')}</button>}
          <button disabled={busy} aria-label={tr(language,'Remove item','移除商品','Buang item')} onClick={() => mutate(() => removeFromCart(item.id))} className="ml-auto flex min-h-12 min-w-12 items-center justify-center rounded-lg text-red-600"><Trash2 size={18}/></button>
        </div>
      </div>;
    })}
  </div>;
}
