import React, { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils';
import { MENU_ITEMS, SIZES, NOODLE_BASES, ADD_ONS } from '../constants';
import { ArrowLeft, Trash2, Utensils, ShoppingBag } from 'lucide-react';
import { OrderType } from '../types';

interface Props {
  onBack: () => void;
}

export default function CustomerCheckout({ onBack }: Props) {
  const { language, cart, removeFromCart, submitOrder } = useStore();
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [tableNo, setTableNo] = useState('');

  const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleConfirm = async () => {
    if (orderType === 'Dine-in' && !tableNo.trim()) {
      alert(language === 'en' ? 'Please enter a table number.' : '请输入桌号。');
      return;
    }

    await submitOrder(orderType, tableNo);
    alert(language === 'en' ? 'Order Submitted! Please pay at the counter.' : '订单已提交！请到柜台付款。');
    onBack();
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-zinc-900 flex flex-col items-center justify-center p-4">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {language === 'en' ? 'Your cart is empty' : '购物车是空的'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-center">
          {language === 'en' ? 'Looks like you haven\'t added anything yet.' : '看来您还没有添加任何商品。'}
        </p>
        <button 
          onClick={onBack}
          className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-full transition-colors"
        >
          {language === 'en' ? 'Browse Menu' : '浏览菜单'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-zinc-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-primary/10">
        <div className="flex items-center p-4 justify-between">
          <button onClick={onBack} className="text-slate-900 dark:text-slate-100 flex w-10 h-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">
            {language === 'en' ? 'Checkout' : '结账'}
          </h1>
        </div>
      </header>

      <main className="flex-1 w-full pb-32">
        {/* Header Image */}
        <div className="w-full h-40 bg-center bg-no-repeat bg-cover" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCjegoCLzYirXlh1HTLs2_xx75ZJoMPr5SyRVMiS8xTZ1uHZhqRoWFrEDGlID_-pHYBji24mgud-wfj8HtJWpu5iDpCcuWU-on863ufLGMwqrB01nDP6Xq_QxfBQMYBFa5xys0XxG-KzBmBkXxEo0FSPF4OAZhLvJ9s6wn1yhcxFlgwpnkNCm7tg29l-8URv4vqEQliXrBD2PKOqGjwXRKUN9QqkYXarnIo5-Gpzgyqq1vMsjMMadsKz-1Yq96yxHxnRWaQib9OFU2w")' }}></div>

        <div className="p-6 space-y-8">
          {/* Order Type */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              {language === 'en' ? 'Order Type / 订单类型' : '订单类型 / Order Type'}
            </h2>
            <div className="flex bg-primary/10 p-1.5 rounded-full">
              <button
                onClick={() => setOrderType('Dine-in')}
                className={`flex-1 py-3 text-sm font-bold rounded-full transition-all ${
                  orderType === 'Dine-in' 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-primary hover:bg-primary/5'
                }`}
              >
                {language === 'en' ? 'Dine-in / 堂食' : '堂食 / Dine-in'}
              </button>
              <button
                onClick={() => setOrderType('Takeaway')}
                className={`flex-1 py-3 text-sm font-bold rounded-full transition-all ${
                  orderType === 'Takeaway' 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-primary hover:bg-primary/5'
                }`}
              >
                {language === 'en' ? 'Takeaway / 外带' : '外带 / Takeaway'}
              </button>
            </div>
          </section>

          {/* Table Number */}
          {orderType === 'Dine-in' && (
            <section className="animate-in fade-in slide-in-from-top-2">
              <label className="block">
                <span className="block text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                  {language === 'en' ? 'Table Number / 桌号' : '桌号 / Table Number'}
                </span>
                <input 
                  type="text" 
                  value={tableNo}
                  onChange={(e) => setTableNo(e.target.value)}
                  placeholder={language === 'en' ? 'e.g. 12' : '例如：12'}
                  className="w-full bg-white dark:bg-zinc-800 border border-primary/20 rounded-xl px-4 py-4 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow text-lg font-semibold"
                />
              </label>
            </section>
          )}

          {/* Order Summary */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              {language === 'en' ? 'Order Summary / 订单摘要' : '订单摘要 / Order Summary'}
            </h2>
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-primary/10 p-5 space-y-5 shadow-sm">
              {cart.map((item) => {
                const menuItem = MENU_ITEMS.find(m => m.id === item.menuItemId);
                const sizeName = SIZES.find(s => s.id === item.size)?.name[language];
                const noodles = item.noodleBases.map(n => NOODLE_BASES.find(nb => nb.id === n)?.name[language]).join(' + ');
                const addons = item.addOns.map(a => ADD_ONS.find(ao => ao.id === a)?.name[language]).join(', ');

                return (
                  <div key={item.id} className="flex gap-4 pb-5 border-b border-primary/5 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                          {item.quantity}x {menuItem?.name[language]}
                        </h3>
                        <span className="font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap ml-4">
                          {formatCurrency(item.totalPrice)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                        {sizeName} • {noodles}
                        {addons && ` • +${addons}`}
                      </p>
                      <div className="flex items-center justify-end">
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-600 p-1 flex items-center gap-1 text-xs font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="pt-5 border-t border-dashed border-primary/20">
                <div className="flex justify-between items-center mb-3 text-slate-500 dark:text-slate-400 text-sm font-medium">
                  <span>{language === 'en' ? 'Subtotal' : '小计'}</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between items-center mb-4 text-slate-500 dark:text-slate-400 text-sm font-medium">
                  <span>{language === 'en' ? 'Service Charge (0%)' : '服务费 (0%)'}</span>
                  <span>RM 0.00</span>
                </div>
                <div className="flex justify-between items-center text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  <span>{language === 'en' ? 'Total' : '总计'}</span>
                  <span className="text-primary">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-primary/10 p-6 pb-safe z-40 max-w-md mx-auto">
        <button 
          onClick={handleConfirm}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/30 text-lg"
        >
          {language === 'en' ? 'Confirm Order / 确认下单' : '确认下单 / Confirm Order'}
        </button>
        <p className="text-center text-xs text-slate-400 mt-3 font-medium">
          Please proceed to the counter to make your payment.
        </p>
      </div>
    </div>
  );
}

