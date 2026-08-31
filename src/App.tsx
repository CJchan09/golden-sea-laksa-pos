/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import CustomerHome from './components/CustomerHome';
import CustomerCheckout from './components/CustomerCheckout';
import CashierLayout from './components/CashierLayout';
import KitchenDisplay from './components/KitchenDisplay';
import AdminLogin from './components/AdminLogin';
import { StoreProvider } from './store';
import { IS_PUBLIC_DEMO } from './demo-mode';

type Route = 'landing' | 'order' | 'checkout' | 'cashier' | 'kitchen';

function getRouteFromHash(): Route {
  const hash = window.location.hash;
  if (hash.startsWith('#/cashier')) return 'cashier';
  if (hash.startsWith('#/kitchen')) return 'kitchen';
  if (hash.startsWith('#/order/checkout')) return 'checkout';
  if (hash.startsWith('#/order')) return 'order';
  return 'landing';
}

export default function App() {
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
      <StoreProvider>
        <div className="min-h-dvh bg-zinc-100 dark:bg-black font-display text-slate-900 dark:text-slate-100">
          <CashierLayout onLogout={handleAdminLogout} />
        </div>
      </StoreProvider>
    );
  }

  // Kitchen follows the same build-level access policy as the cashier.
  if (route === 'kitchen') {
    if (!hasStaffAccess) {
      return <AdminLogin onLogin={handleAdminLogin} />;
    }
    return (
      <StoreProvider>
        <div className="min-h-dvh bg-black font-display text-slate-100">
          <KitchenDisplay />
        </div>
      </StoreProvider>
    );
  }

  // Mobile-friendly customer/order flow — no login required.
  return (
    <StoreProvider>
      <div className="min-h-dvh bg-zinc-100 dark:bg-black font-display text-slate-900 dark:text-slate-100 flex justify-center">
        <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-dvh shadow-2xl relative overflow-x-hidden">
          {route === 'order' && (
            <CustomerHome
              onBack={() => { window.location.hash = ''; }}
              onCheckout={() => { window.location.hash = '#/order/checkout'; }}
            />
          )}

          {route === 'checkout' && (
            <CustomerCheckout
              onBack={() => { window.location.hash = '#/order'; }}
            />
          )}
        </div>
      </div>
    </StoreProvider>
  );
}
