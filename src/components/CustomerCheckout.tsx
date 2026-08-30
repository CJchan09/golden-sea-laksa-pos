import React, { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils';
import { SIZES, NOODLE_BASES, ADD_ONS } from '../constants';
import { OrderType, PaymentMethod } from '../types';
import { Banknote, QrCode, ArrowLeft, Trash2, ShoppingBag, X } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export default function CustomerCheckout({ onBack }: Props) {
  const { language, cart, removeFromCart, submitOrder, settings } = useStore();
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [tableNo, setTableNo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const takeawayFee = orderType === 'Takeaway' ? (settings.takeawayFee || 0) : 0;
  const taxAmount = settings.enableTax ? parseFloat(((subtotal + takeawayFee) * (settings.taxRate / 100)).toFixed(2)) : 0;
  const totalAmount = subtotal + takeawayFee + taxAmount;

  const handleConfirm = async () => {
    setFormError('');
    if (orderType === 'Dine-in' && !tableNo.trim()) {
      setFormError(language === 'en' ? 'Please enter a table number.' : '请输入桌号。');
      return;
    }
    if (!paymentMethod) {
      setFormError(language === 'en' ? 'Please select a payment method.' : '请选择支付方式。');
      return;
    }

    if (paymentMethod === 'QR Pay' && settings.qrImage) {
      setShowQRModal(true);
      return;
    }

    await finishCheckout();
  };

  const finishCheckout = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submitOrder(orderType, tableNo);
      if (paymentMethod === 'Cash') {
        alert(language === 'en' ? 'Order Submitted! Please pay at the counter.' : '订单已提交！请到柜台付款。');
      } else {
        alert(language === 'en' ? 'Order Submitted! Awaiting payment confirmation.' : '订单已提交！等待管理员确认收款。');
      }
      onBack();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-dvh bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-4">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-10 h-10 text-emphasis dark:text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {language === 'en' ? 'Your cart is empty' : '购物车是空的'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-center">
          {language === 'en' ? 'Looks like you haven\'t added anything yet.' : '看来您还没有添加任何商品。'}
        </p>
        <button 
          onClick={onBack}
          className="bg-primary hover:bg-primary-hover text-on-primary font-bold py-3 px-8 rounded-full transition-colors"
        >
          {language === 'en' ? 'Browse Menu' : '浏览菜单'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background-light dark:bg-background-dark flex flex-col">
      {/* Header */}
      <header className="pt-safe sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-black/90">
        <div className="flex items-center p-4 justify-between">
          <button type="button" onClick={onBack} aria-label={language === 'en' ? 'Back to menu' : '返回菜单'} className="text-slate-900 dark:text-slate-100 flex w-11 h-11 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
            <ArrowLeft className="w-6 h-6" aria-hidden="true" />
          </button>
          <h1 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">
            {language === 'en' ? 'Checkout' : '结账'}
          </h1>
        </div>
      </header>

      <main className="flex-1 w-full pb-32">
        {/* Header Image */}
        <div className="w-full h-40 bg-center bg-no-repeat bg-cover" style={{ backgroundImage: `url("${settings.coverPhoto}")` }}></div>

        <div className="p-6 space-y-8">
          {formError && (
            <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {formError}
            </p>
          )}

          {/* Order Type */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              {language === 'en' ? 'Order Type / 订单类型' : '订单类型 / Order Type'}
            </h2>
            <div className="flex bg-primary/10 p-1.5 rounded-full">
              <button
                type="button"
                onClick={() => setOrderType('Dine-in')}
                aria-pressed={orderType === 'Dine-in'}
                className={`flex-1 py-3 text-sm font-bold rounded-full transition-all ${
                  orderType === 'Dine-in'
                    ? 'bg-primary text-on-primary shadow-md'
                    : 'text-emphasis hover:bg-primary/10 dark:text-primary'
                }`}
              >
                {language === 'en' ? 'Dine-in / 堂食' : '堂食 / Dine-in'}
              </button>
              <button
                type="button"
                onClick={() => setOrderType('Takeaway')}
                aria-pressed={orderType === 'Takeaway'}
                className={`flex-1 py-3 text-sm font-bold rounded-full transition-all ${
                  orderType === 'Takeaway'
                    ? 'bg-primary text-on-primary shadow-md'
                    : 'text-emphasis hover:bg-primary/10 dark:text-primary'
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-5 shadow-sm dark:border-zinc-700 dark:bg-surface-dark">
              {cart.map((item) => {
                const menuItem = settings.menuItems.find(m => m.id === item.menuItemId);
                const sizeName = item.sizeId
                  ? menuItem?.sizes.find(s => s.id === item.sizeId)?.name[language] || ''
                  : SIZES.find(s => s.id === (item.size as any))?.name[language];
                const noodlesArr = item.noodleBaseIds
                  ? item.noodleBaseIds.map(n => menuItem?.noodleBases.find(nb => nb.id === n)?.name[language])
                  : (item.noodleBases || []).map(n => NOODLE_BASES.find(nb => nb.id === (n as any))?.name[language]);
                const noodles = noodlesArr.filter(Boolean).join(' + ');
                const addonsArr = item.addOnIds
                  ? item.addOnIds.map(a => menuItem?.addOns.find(ao => ao.id === a)?.name[language])
                  : (item.addOns || []).map(a => ADD_ONS.find(ao => ao.id === (a as any))?.name[language]);
                const addons = addonsArr.filter(Boolean).join(', ');

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
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`${language === 'en' ? 'Remove' : '移除'} ${menuItem?.name[language] ?? 'item'}`}
                          className="min-h-11 text-red-600 hover:text-red-700 px-2 flex items-center gap-1 text-sm font-semibold"
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
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {orderType === 'Takeaway' && settings.takeawayFee > 0 && (
                  <div className="flex justify-between items-center mb-3 text-slate-500 dark:text-slate-400 text-sm font-medium">
                    <span>{language === 'en' ? 'Takeaway Fee' : '打包费'}</span>
                    <span>{formatCurrency(takeawayFee)}</span>
                  </div>
                )}
                {settings.enableTax && (
                  <div className="flex justify-between items-center mb-4 text-slate-500 dark:text-slate-400 text-sm font-medium">
                    <span>{language === 'en' ? `Tax (${settings.taxRate}%)` : `税务 (${settings.taxRate}%)`}</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  <span>{language === 'en' ? 'Total' : '总计'}</span>
                  <span className="text-emphasis dark:text-primary">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Payment Method */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              {language === 'en' ? 'Payment Method / 支付方式' : '支付方式 / Payment Method'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => { setPaymentMethod('Cash'); setFormError(''); }}
                aria-pressed={paymentMethod === 'Cash'}
                className={`flex flex-col items-center justify-center py-4 rounded-2xl border-2 transition-all ${
                  paymentMethod === 'Cash'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-primary/10 bg-white dark:bg-zinc-800 text-slate-500 hover:border-green-500/50'
                }`}
              >
                <Banknote className="w-8 h-8 mb-2" />
                <span className="font-bold text-sm">Cash / 现金</span>
              </button>
              <button
                type="button"
                onClick={() => { setPaymentMethod('QR Pay'); setFormError(''); }}
                aria-pressed={paymentMethod === 'QR Pay'}
                className={`flex flex-col items-center justify-center py-4 rounded-2xl border-2 transition-all ${
                  paymentMethod === 'QR Pay'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'border-primary/10 bg-white dark:bg-zinc-800 text-slate-500 hover:border-blue-500/50'
                }`}
              >
                <QrCode className="w-8 h-8 mb-2" />
                <span className="font-bold text-sm">QR Pay / 扫码支付</span>
              </button>
            </div>

            {paymentMethod === 'Cash' && (
              <div className="mt-4 text-center text-slate-500 font-medium text-sm">
                {language === 'en' ? 'Please pay at the cashier counter.' : '请到柜台支付现金。'}
              </div>
            )}
            {paymentMethod === 'QR Pay' && (
              <div className="mt-4 text-center text-slate-500 font-medium text-sm">
                {language === 'en' ? 'A QR Code will appear for you to scan or save after confirming.' : '确认下单后，将弹出二维码供您扫码或保存以完成支付。'}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800 p-6 pb-safe z-40 max-w-md mx-auto">
        <button 
          type="button"
          onClick={handleConfirm}
          disabled={!paymentMethod || isSubmitting}
          aria-busy={isSubmitting}
          className={`w-full font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all text-lg ${
            !paymentMethod || isSubmitting
              ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-hover text-on-primary shadow-lg shadow-black/15 active:scale-[0.98]'
          }`}
        >
          {isSubmitting
            ? (language === 'en' ? 'Submitting…' : '正在提交…')
            : (language === 'en' ? 'Confirm Order / 确认下单' : '确认下单 / Confirm Order')}
        </button>
        <p className="text-center text-xs text-slate-400 mt-3 font-medium">
          {paymentMethod === 'QR Pay'
            ? (language === 'en' ? 'Your order needs staff payment confirmation.' : '付款后仍需员工确认收款。')
            : (language === 'en' ? 'Please pay at the cashier counter.' : '请到收银柜台付款。')}
        </p>
      </div>

      {/* QR Modal */}
      {showQRModal && settings.qrImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="qr-payment-title" className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setShowQRModal(false)}
              aria-label={language === 'en' ? 'Close QR payment' : '关闭扫码付款'}
              className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300 rounded-full hover:bg-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6 mt-2">
              <QrCode className="w-12 h-12 text-blue-500 mx-auto mb-3" />
              <h3 id="qr-payment-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {language === 'en' ? 'Scan to Pay' : '扫码支付'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {language === 'en' ? 'Save this QR or scan it with your wallet app to pay ' : '请长按保存二维码，或用支付App扫码付款 '}
                <strong className="text-gray-900 dark:text-white text-lg">{formatCurrency(totalAmount)}</strong>
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border-2 border-blue-100 dark:border-blue-900/50 mb-6 flex justify-center">
              <img src={settings.qrImage} alt="QR Payment" className="max-w-[220px] w-full rounded-lg shadow-sm" />
            </div>

            <button
              type="button"
              onClick={() => {
                setShowQRModal(false);
                finishCheckout();
              }}
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-[0.98] text-lg"
            >
              {language === 'en' ? 'Done & Submit Order' : '支付完成，提交订单'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
