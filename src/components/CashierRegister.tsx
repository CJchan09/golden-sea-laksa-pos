import React, { useState } from 'react';
import { useStore } from '../store';
import { MenuItem, OrderType, PaymentMethod } from '../types';
import { formatCurrency } from '../utils';
import CustomizationModal from './CustomizationModal';
import { ShoppingCart, Trash2, CreditCard, Banknote, X, QrCode } from 'lucide-react';

export default function CashierRegister() {
  const { language, cart, addToCart, removeFromCart, clearCart, submitOrder, markAsPaid, orders, settings } = useStore();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [tableNo, setTableNo] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (orderType === 'Dine-in' && !tableNo.trim()) {
      alert('Please enter a table number. / 请输入桌号。');
      return;
    }
    setShowPaymentModal(true);
  };

  const handlePayment = async (method: PaymentMethod) => {
    const newOrderId = await submitOrder(orderType, tableNo);
    setShowPaymentModal(false);
    setTableNo('');
    
    // Mark the newly created order as paid immediately
    if (newOrderId) {
      markAsPaid(newOrderId, method);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Menu Grid */}
      <div className="flex-1">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Register / 收银台</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {settings.menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="flex flex-col text-left bg-white dark:bg-zinc-900 border-2 border-transparent hover:border-orange-200 dark:hover:border-orange-900/50 active:border-orange-500 active:scale-95 transition-all rounded-2xl shadow-sm overflow-hidden group"
            >
              <div className="aspect-video w-full overflow-hidden">
                <img 
                  src={item.image} 
                  alt={item.name[language]} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight mb-1">
                  {item.name.en}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {item.name.zh}
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
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden lg:h-[calc(100vh-12rem)]">
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-950/50">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Current Order / 当前订单
          </h3>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-600 font-bold uppercase tracking-wider">
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 py-12">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">Cart is empty / 购物车为空</p>
            </div>
          ) : (
            cart.map(item => {
              const menuItem = settings.menuItems.find(m => m.id === item.menuItemId);
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
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-colors ${
                orderType === 'Dine-in' ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              堂食 Dine-in
            </button>
            <button
              onClick={() => setOrderType('Takeaway')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-colors ${
                orderType === 'Takeaway' ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              外带 Takeaway
            </button>
          </div>

          {orderType === 'Dine-in' && (
            <input
              type="text"
              placeholder="Table No. / 桌号"
              value={tableNo}
              onChange={e => setTableNo(e.target.value)}
              className="w-full mb-4 px-3 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-orange-500 outline-none"
            />
          )}

          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-gray-900 dark:text-white">Total / 总计</span>
            <span className="text-xl font-extrabold text-orange-600 dark:text-orange-500">{formatCurrency(totalAmount)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 dark:disabled:bg-zinc-800 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-lg shadow-lg shadow-orange-600/20"
          >
            <CreditCard className="w-5 h-5" />
            Checkout / 结账
          </button>
        </div>
      </div>

      {/* Customization Modal */}
      {selectedItem && (
        <CustomizationModal
          item={selectedItem}
          language={language}
          onClose={() => setSelectedItem(null)}
          onAdd={addToCart}
        />
      )}

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment Method / 支付方式</h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-center mb-4">
                <span className="text-2xl font-extrabold text-orange-600">{formatCurrency(totalAmount)}</span>
              </div>
              <button
                onClick={() => handlePayment('Cash')}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-3 transition-colors text-lg"
              >
                <Banknote className="w-6 h-6" />
                Cash / 现金
              </button>
              <button
                onClick={() => handlePayment('QR Pay')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-3 transition-colors text-lg"
              >
                <QrCode className="w-6 h-6" />
                QR Pay / 扫码支付
              </button>
              {/* Show uploaded QR image if available */}
              {settings.qrImage && (
                <div className="mt-2 p-3 bg-white rounded-xl border border-gray-200 dark:border-zinc-700">
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-2 font-medium">QR Code / 二维码</p>
                  <img src={settings.qrImage} alt="QR Payment" className="w-full max-h-48 object-contain mx-auto rounded-lg" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
