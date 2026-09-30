/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import CustomerHome from './components/CustomerHome';
import CustomerCheckout from './components/CustomerCheckout';
import CustomerReceipt from './components/CustomerReceipt';
import AutoDailyExport from './components/AutoDailyExport';
import PwaStatus from './components/PwaStatus';
import CashierLayout from './components/CashierLayout';
import KitchenDisplay from './components/KitchenDisplay';
import AdminLogin from './components/AdminLogin';
import { StoreProvider, useStore } from './store';
import { tr } from './i18n';
import { IS_PUBLIC_DEMO } from './demo-mode';

type Route = 'landing' | 'order' | 'checkout' | 'receipt' | 'cashier' | 'kitchen';
const IS_ANDROID_APP = import.meta.env.VITE_ANDROID_APP === 'true';

function getRouteFromHash(): Route {
  const hash = window.location.hash;
  if (hash.startsWith('#/cashier')) return 'cashier';
  if (hash.startsWith('#/kitchen')) return 'kitchen';
  if (hash.startsWith('#/order/receipt/')) return 'receipt';
  if (hash.startsWith('#/order/checkout')) return 'checkout';
  if (hash.startsWith('#/order')) return 'order';
  return IS_ANDROID_APP ? 'cashier' : 'landing';
}

export default function App() {
  return <StoreProvider><AutoDailyExport /><AppRoutes />{!IS_ANDROID_APP && <PwaStatus />}</StoreProvider>;
}

function AppRoutes() {
  const { ready, language, storageError } = useStore();
  const [route, setRoute] = useState<Route>(getRouteFromHash);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('golden_sea_admin_auth') === 'true';
  });
  const hasStaffAccess = IS_PUBLIC_DEMO || isAdminAuthenticated;

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRouteFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAdminLogin = () => {
    setIsAdminAuthenticated(true);
  };

  if (!ready) return <div className="min-h-dvh bg-zinc-950 p-6 text-white" role={storageError ? 'alert' : 'status'}>
    <p>{storageError ? tr(language, 'Local data could not be opened. Your existing data is kept.', '未能打开本机资料，原有资料已保留。', 'Data tempatan tidak dapat dibuka. Data asal dikekalkan.') : tr(language, 'Opening local data…', '正在打开本机资料…', 'Membuka data tempatan…')}</p>
    {storageError && <button className="mt-4 min-h-12 rounded-xl bg-primary px-4 text-on-primary" onClick={() => window.location.reload()}>{tr(language, 'Retry', '重试', 'Cuba lagi')}</button>}
  </div>;

  if (route === 'landing') {
    return (
      <LandingPage
        onStart={() => { window.location.hash = '#/order'; }}
        onAdmin={() => { window.location.hash = IS_PUBLIC_DEMO ? '#/cashier/edit' : '#/cashier'; }}
        onKitchen={() => { window.location.hash = '#/kitchen'; }}
      />
    );
  }

  const handleAdminLogout = () => {
    sessionStorage.removeItem('golden_sea_admin_auth');
    setIsAdminAuthenticated(false);
    window.location.hash = '';
  };

  // Public demos bypass the local gate; private builds retain it.
  if (route === 'cashier') {
    if (!hasStaffAccess) {
      return <AdminLogin onLogin={handleAdminLogin} />;
    }
    return (
        <div className="pos-app pos-workspace min-h-dvh bg-zinc-100 dark:bg-black font-display text-slate-900 dark:text-slate-100">
          <CashierLayout onLogout={IS_ANDROID_APP
            ? () => { window.location.hash = '#/order'; }
            : handleAdminLogout} />
        </div>
    );
  }

  // Kitchen follows the same build-level access policy as the cashier.
  if (route === 'kitchen') {
    if (!hasStaffAccess) {
      return <AdminLogin onLogin={handleAdminLogin} />;
    }
    return (
        <div className="pos-app pos-workspace min-h-dvh bg-black font-display text-slate-100">
          <KitchenDisplay />
        </div>
    );
  }

  // Mobile-friendly customer/order flow — no login required.
  return (
      <div className="min-h-dvh bg-zinc-100 dark:bg-black font-display text-slate-900 dark:text-slate-100 flex justify-center">
        <div className="pos-app pos-workspace w-full max-w-7xl bg-background-light dark:bg-background-dark min-h-dvh shadow-2xl relative">
          {route === 'order' && (
            <CustomerHome
              onBack={() => { window.location.hash = '#/cashier'; }}
              onCheckout={() => { window.location.hash = '#/order/checkout'; }}
            />
          )}

          {route === 'checkout' && (
            <CustomerCheckout
              onBack={() => { window.location.hash = '#/order'; }}
            />
          )}
          {route === 'receipt' && <CustomerReceipt />}
        </div>
      </div>
  );
}
