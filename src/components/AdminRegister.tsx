import React, { useState } from 'react';
import { useStore } from '../store';
import { MENU_ITEMS } from '../constants';
import { MenuItem, OrderType } from '../types';
import { formatCurrency } from '../utils';
import CustomizationModal from './CustomizationModal';
import { ShoppingCart, Trash2 } from 'lucide-react';

export default function AdminRegister() {
  const { language, cart, addToCart, removeFromCart, clearCart, submitOrder } = useStore();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [tableNo, setTableNo] = useState('');

  const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (orderType === 'Dine-in' && !tableNo.trim()) {
      alert('Please enter a table number.');
      return;
    }
    submitOrder(orderType, tableNo);
    setTableNo('');
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Menu Grid */}
      <div className="flex-1">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Register</h2>
        <div className="grid grid-cols-2 gap-4">
          {MENU_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="flex flex-col text-left bg-white dark:bg-zinc-900 border-2 border-transparent hover:border-orange-200 dark:hover:border-orange-900/50 active:border-orange-500 active:scale-95 transition-all rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="aspect-video w-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <span className="text-4xl">🍜</span>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight mb-2">
                  {item.name[language]}
                </p>
                <p className="text-orange-600 dark:text-orange-400 font-extrabold">
                  {formatCurrency(item.basePrice)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-full md:w-80 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden h-[calc(100vh-12rem)]">
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-950/50">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Current Order
          </h3>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-600 font-bold uppercase tracking-wider">
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            cart.map(item => {
              const menuItem = MENU_ITEMS.find(m => m.id === item.menuItemId);
              return (
                <div key={item.id} className="flex justify-between items-start pb-4 border-b border-gray-100 dark:border-zinc-800 last:border-0 last:pb-0">
                  <div className="flex-1 pr-2">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight mb-1">
                      {menuItem?.name[language]}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Qty: {item.quantity} • {formatCurrency(item.totalPrice)}
                    </p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/50">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setOrderType('Dine-in')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                orderType === 'Dine-in' ? 'bg-orange-600 text-white' : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              Dine-in
            </button>
            <button
              onClick={() => setOrderType('Takeaway')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                orderType === 'Takeaway' ? 'bg-orange-600 text-white' : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              Takeaway
            </button>
          </div>

          {orderType === 'Dine-in' && (
            <input
              type="text"
              placeholder="Table No."
              value={tableNo}
              onChange={e => setTableNo(e.target.value)}
              className="w-full mb-4 px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            />
          )}

          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-gray-900 dark:text-white">Total</span>
            <span className="text-xl font-extrabold text-orange-600 dark:text-orange-500">{formatCurrency(totalAmount)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 dark:disabled:bg-zinc-800 text-white font-bold rounded-xl transition-colors"
          >
            Checkout
          </button>
        </div>
      </div>

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
