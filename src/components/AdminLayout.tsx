import React, { useState } from 'react';
import { useStore } from '../store';
import { LogOut, Store, Clock, History } from 'lucide-react';
import AdminRegister from './AdminRegister';
import AdminActive from './AdminActive';
import AdminHistory from './AdminHistory';

interface Props {
  onLogout: () => void;
}

export default function AdminLayout({ onLogout }: Props) {
  const { isOnline } = useStore();
  const [activeTab, setActiveTab] = useState<'register' | 'active' | 'history'>('register');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                Golden Sea Laksa
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Admin POS</span>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} title={isOnline ? 'Online' : 'Offline'} />
              </div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-gray-500 dark:text-gray-400"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 pb-24">
        {activeTab === 'register' && <AdminRegister />}
        {activeTab === 'active' && <AdminActive />}
        {activeTab === 'history' && <AdminHistory />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 pb-safe z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center px-2">
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
