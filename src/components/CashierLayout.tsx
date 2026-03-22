import React, { useState } from 'react';
import { useStore } from '../store';
import { LogOut, Store, Clock, History, Wifi, WifiOff, Lock, Eye, EyeOff, Settings, KeyRound } from 'lucide-react';
import CashierRegister from './CashierRegister';
import CashierActive from './CashierActive';
import CashierHistory from './CashierHistory';
import EditMenu from './EditMenu';
import { format } from 'date-fns';

const PASSWORD_KEY = 'golden_sea_laksa_admin_pw';
const DEFAULT_PASSWORD = 'admin123';

function getAdminPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
}

interface Props {
  onLogout: () => void;
}

export default function CashierLayout({ onLogout }: Props) {
  const { isOnline } = useStore();
  const [activeTab, setActiveTab] = useState<'register' | 'active' | 'history' | 'edit'>('register');
  // History password gate
  const [historyUnlocked, setHistoryUnlocked] = useState(false);
  const [historyPw, setHistoryPw] = useState('');
  const [historyPwError, setHistoryPwError] = useState('');
  const [showPw, setShowPw] = useState(false);
  
  // Forget password state
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw1, setNewPw1] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleHistoryLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (historyPw === getAdminPassword()) {
      setHistoryUnlocked(true);
      setHistoryPwError('');
    } else {
      setHistoryPwError('密码错误 / Wrong password');
    }
  };

  const handleChangePassword = () => {
    setPwMsg('');
    setPwSuccess(false);
    if (oldPw !== getAdminPassword()) {
      setPwMsg('旧密码错误 / Old password is wrong');
      return;
    }
    if (!newPw1 || newPw1.length < 4) {
      setPwMsg('新密码至少4位 / New password must be at least 4 chars');
      return;
    }
    if (newPw1 !== newPw2) {
      setPwMsg('两次输入不一致 / Passwords do not match');
      return;
    }
    localStorage.setItem(PASSWORD_KEY, newPw1);
    setPwMsg('密码已更新 / Password updated!');
    setPwSuccess(true);
    setOldPw('');
    setNewPw1('');
    setNewPw2('');
    setTimeout(() => {
      setShowForgotPw(false);
      setPwMsg('');
      setPwSuccess(false);
    }, 1500);
  };

  // History Password Gate component
  const HistoryPasswordGate = () => {
    if (showForgotPw) {
      return (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/10">
            <KeyRound className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Change Password</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">修改历史记录密码</p>
          
          <div className="w-full max-w-xs space-y-4">
            <div>
              <input
                type="password"
                value={oldPw}
                onChange={e => setOldPw(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Old Password / 旧密码"
              />
            </div>
            <div>
              <input
                type="password"
                value={newPw1}
                onChange={e => setNewPw1(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="New Password / 新密码"
              />
            </div>
            <div>
              <input
                type="password"
                value={newPw2}
                onChange={e => setNewPw2(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Confirm Password / 确认新密码"
              />
            </div>

            {pwMsg && (
              <p className={`text-sm font-medium text-center ${pwSuccess ? 'text-green-500' : 'text-red-500'}`}>
                {pwMsg}
              </p>
            )}

            <button
              onClick={handleChangePassword}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg active:scale-[0.98]"
            >
              Confirm / 确认修改
            </button>

            <button
              onClick={() => { setShowForgotPw(false); setPwMsg(''); }}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-400 font-bold rounded-xl transition-colors"
            >
              Back / 返回
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">History Locked</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">历史记录需要密码查看</p>
        
        <form onSubmit={handleHistoryLogin} className="w-full max-w-xs space-y-3">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={historyPw}
              onChange={e => { setHistoryPw(e.target.value); setHistoryPwError(''); }}
              placeholder="Enter password / 输入密码"
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 pr-12 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500 outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {historyPwError && (
            <p className="text-red-500 text-sm font-medium text-center">⚠️ {historyPwError}</p>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-colors"
          >
            Unlock / 解锁
          </button>
          <button
            type="button"
            onClick={() => setShowForgotPw(true)}
            className="w-full text-center text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 text-sm font-medium transition-colors pt-4"
          >
            Forgot Password? / 忘记密码？
          </button>
        </form>
      </div>
    );
  };

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
        {activeTab === 'edit' && <EditMenu />}
        {activeTab === 'history' && (
          historyUnlocked ? <CashierHistory /> : <HistoryPasswordGate />
        )}
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
          
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
              activeTab === 'edit' 
                ? 'text-orange-600 dark:text-orange-500' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <Settings className={`w-6 h-6 ${activeTab === 'edit' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Edit</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
