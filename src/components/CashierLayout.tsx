import React, { useState } from 'react';
import { useStore } from '../store';
import { LogOut, Store, Clock, History, Wifi, WifiOff } from 'lucide-react';
import CashierRegister from './CashierRegister';
import CashierActive from './CashierActive';
import CashierHistory from './CashierHistory';
import { format } from 'date-fns';

interface Props {
  onLogout: () => void;
}

export default function CashierLayout({ onLogout }: Props) {
  const { isOnline } = useStore();
  const [activeTab, setActiveTab] = useState<'register' | 'active' | 'history'>('register');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                Golden Sea Laksa
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  收银台 · {format(new Date(), 'yyyy-MM-dd')}
                </span>
                <span className="flex items-center gap-1">
                  {isOnline ? (
                    <Wifi className="w-3 h-3 text-green-500" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-red-500" />
                  )}
                  <span className={`text-[10px] font-bold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-gray-500 dark:text-gray-400"
            title="Return to Home"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 pb-24">
        {activeTab === 'register' && <CashierRegister />}
        {activeTab === 'active' && <CashierActive />}
        {activeTab === 'history' && <CashierHistory />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 pb-safe z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-2">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
              activeTab === 'register' 
                ? 'text-orange-600 dark:text-orange-500' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <Store className={`w-6 h-6 ${activeTab === 'register' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Register</span>
          </button>
          
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
              activeTab === 'active' 
                ? 'text-orange-600 dark:text-orange-500' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <Clock className={`w-6 h-6 ${activeTab === 'active' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Active</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
              activeTab === 'history' 
                ? 'text-orange-600 dark:text-orange-500' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <History className={`w-6 h-6 ${activeTab === 'history' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
