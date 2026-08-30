import React, { useState } from 'react';
import { useStore } from '../store';
import { PaymentMethod, MenuItem, OrderType } from '../types';
import { formatCurrency } from '../utils';
import CustomizationModal from './CustomizationModal';
import { ShoppingCart, Trash2, Banknote, QrCode } from 'lucide-react';

export default function AdminRegister() {
  const { language, cart, addToCart, removeFromCart, clearCart, submitOrder, markAsPaid, settings } = useStore();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [tableNo, setTableNo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | 'Unpaid' | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const takeawayFee = orderType === 'Takeaway' ? (settings.takeawayFee || 0) : 0;
  const taxAmount = settings.enableTax ? parseFloat(((subtotal + takeawayFee) * (settings.taxRate / 100)).toFixed(2)) : 0;
  const totalAmount = subtotal + takeawayFee + taxAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (orderType === 'Dine-in' && !tableNo.trim()) {
      alert('Please enter a table number.');
      return;
    }
    if (!paymentMethod) {
      alert('Please select a payment method.');
      return;
    }

    const newOrderId = await submitOrder(orderType, tableNo);
    if (newOrderId) {
      if (paymentMethod === 'Cash') {
        markAsPaid(newOrderId, 'Cash');
        alert('Order placed & paid with Cash.');
        resetForm();
      } else if (paymentMethod === 'QR Pay') {
        setCurrentOrderId(newOrderId);
        setShowQR(true);
      } else {
        alert('Order placed. Awaiting payment.');
        resetForm();
      }
    }
  };

  const resetForm = () => {
    setTableNo('');
    setPaymentMethod(null);
    setCurrentOrderId(null);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Menu Grid */}
      <div className="flex-1">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Register</h2>
        <div className="grid grid-cols-2 gap-4">
          {settings.menuItems.map(item => (
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

          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={() => setPaymentMethod('Cash')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-colors ${
                paymentMethod === 'Cash' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-gray-200 dark:border-zinc-800 text-gray-500 hover:border-green-500/50'
              }`}
            >
              <Banknote className="w-5 h-5 mb-1" />
              <span className="text-xs font-bold">Cash</span>
            </button>
            <button
              onClick={() => setPaymentMethod('QR Pay')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-colors ${
                paymentMethod === 'QR Pay' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-gray-200 dark:border-zinc-800 text-gray-500 hover:border-blue-500/50'
              }`}
            >
              <QrCode className="w-5 h-5 mb-1" />
              <span className="text-xs font-bold">QR</span>
            </button>
            <button
              onClick={() => setPaymentMethod('Unpaid')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-colors ${
                paymentMethod === 'Unpaid' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' : 'border-gray-200 dark:border-zinc-800 text-gray-500 hover:border-orange-500/50'
              }`}
            >
              <span className="text-xl leading-none mb-1">⏳</span>
              <span className="text-xs font-bold">Later</span>
            </button>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {orderType === 'Takeaway' && settings.takeawayFee > 0 && (
              <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                <span>Takeaway Fee</span>
                <span>{formatCurrency(takeawayFee)}</span>
              </div>
            )}
            {settings.enableTax && (
              <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                <span>Tax ({settings.taxRate}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-zinc-700">
              <span>Total</span>
              <span className="text-xl font-extrabold text-orange-600 dark:text-orange-500">{formatCurrency(totalAmount)}</span>
            </div>
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

      {showQR && settings.qrImage && currentOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
              QR Payment
            </h3>
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">
              Please present this QR code to the customer to scan and pay <strong className="text-gray-900 dark:text-white">{formatCurrency(totalAmount)}</strong>
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border-2 border-blue-100 dark:border-blue-900/50 mb-6 flex justify-center">
              <img src={settings.qrImage} alt="QR Payment" className="max-w-[220px] w-full rounded-lg shadow-sm" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowQR(false);
                  alert('Order placed. Awaiting payment confirmation.');
                  resetForm();
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl transition-colors"
              >
                Verify Later
              </button>
              <button
                onClick={() => {
                  markAsPaid(currentOrderId, 'QR Pay');
                  setShowQR(false);
                  alert('Payment verified and order placed.');
                  resetForm();
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-[0.98]"
              >
                Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
