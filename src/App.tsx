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

type Route = 'landing' | 'order' | 'cashier' | 'kitchen';

function getRouteFromHash(): Route {
  const hash = window.location.hash;
  if (hash.startsWith('#/cashier')) return 'cashier';
  if (hash.startsWith('#/kitchen')) return 'kitchen';
  if (hash.startsWith('#/order')) return 'order';
  return 'landing';
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRouteFromHash);
  const [orderSubView, setOrderSubView] = useState<'home' | 'checkout'>('home');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('golden_sea_admin_auth') === 'true';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const newRoute = getRouteFromHash();
      setRoute(newRoute);
      if (newRoute === 'order') {
        setOrderSubView('home');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAdminLogin = () => {
    setIsAdminAuthenticated(true);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('golden_sea_admin_auth');
    setIsAdminAuthenticated(false);
    window.location.hash = '';
  };

  // Cashier route — requires login
  if (route === 'cashier') {
    if (!isAdminAuthenticated) {
      return <AdminLogin onLogin={handleAdminLogin} />;
    }
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 font-display text-slate-900 dark:text-slate-100">
        <CashierLayout onLogout={handleAdminLogout} />
      </div>
    );
  }

  // Kitchen route — requires login
  if (route === 'kitchen') {
    if (!isAdminAuthenticated) {
      return <AdminLogin onLogin={handleAdminLogin} />;
    }
    return (
      <div className="min-h-screen bg-zinc-950 font-display text-slate-100">
        <KitchenDisplay />
      </div>
    );
  }

  // Mobile-friendly customer/order flow — NO login required
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 font-display text-slate-900 dark:text-slate-100 flex justify-center">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen shadow-2xl relative overflow-hidden">
        {route === 'landing' && (
          <LandingPage
            onStart={() => {
              window.location.hash = '#/order';
              setOrderSubView('home');
            }}
            onAdmin={() => {
              window.location.hash = '#/cashier';
            }}
          />
        )}

        {route === 'order' && orderSubView === 'home' && (
          <CustomerHome
            onBack={() => { window.location.hash = ''; }}
            onCheckout={() => setOrderSubView('checkout')}
          />
        )}

        {route === 'order' && orderSubView === 'checkout' && (
          <CustomerCheckout
            onBack={() => setOrderSubView('home')}
          />
        )}
      </div>
    </div>
  );
}
