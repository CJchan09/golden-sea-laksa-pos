import React, { useState } from 'react';
import { useStore } from '../store';
import { LogOut, House, Store, Clock, History, Wifi, WifiOff, Lock, Eye, EyeOff, Settings, KeyRound, ChefHat } from 'lucide-react';
import CashierRegister from './CashierRegister';
import CashierActive from './CashierActive';
import CashierHistory from './CashierHistory';
import EditMenu from './EditMenu';
import KitchenDisplay from './KitchenDisplay';
import { format } from 'date-fns';
import { APP_ICON_SRC } from '../brand';
import { IS_PUBLIC_DEMO } from '../demo-mode';

const PASSWORD_KEY = 'golden_sea_laksa_admin_pw';
const DEFAULT_PASSWORD = 'admin123';

function getAdminPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
}

interface Props {
  onLogout: () => void;
}

type CashierTab = 'register' | 'active' | 'kitchen' | 'history' | 'edit';

function getInitialCashierTab(): CashierTab {
  const routeTab = window.location.hash.split('/')[2];
  return routeTab === 'active' || routeTab === 'kitchen' || routeTab === 'history' || routeTab === 'edit'
    ? routeTab
    : 'register';
}

export default function CashierLayout({ onLogout }: Props) {
  const { isOnline, orders, settings } = useStore();
  const [activeTab, setActiveTab] = useState<CashierTab>(getInitialCashierTab);
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
  const hasHistoryAccess = IS_PUBLIC_DEMO || historyUnlocked;
  const kitchenOrderCount = orders.filter(order => order.status === 'Pending' || order.status === 'Preparing').length;

  const selectTab = (tab: CashierTab) => {
    setActiveTab(tab);
    const nextHash = tab === 'register' ? '#/cashier' : `#/cashier/${tab}`;
    window.history.replaceState(null, '', nextHash);
  };

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
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 shadow-lg shadow-primary/10">
            <KeyRound aria-hidden="true" className="h-8 w-8 text-emphasis dark:text-primary" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Change Password</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">修改历史记录密码</p>
          
          <div className="w-full max-w-xs space-y-4">
            <div>
              <input
                type="password"
                autoComplete="current-password"
                value={oldPw}
                onChange={e => setOldPw(e.target.value)}
                aria-label="Old password / 旧密码"
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-primary outline-none"
                placeholder="Old Password / 旧密码"
              />
            </div>
            <div>
              <input
                type="password"
                autoComplete="new-password"
                value={newPw1}
                onChange={e => setNewPw1(e.target.value)}
                aria-label="New password / 新密码"
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-primary outline-none"
                placeholder="New Password / 新密码"
              />
            </div>
            <div>
              <input
                type="password"
                autoComplete="new-password"
                value={newPw2}
                onChange={e => setNewPw2(e.target.value)}
                aria-label="Confirm new password / 确认新密码"
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-primary outline-none"
                placeholder="Confirm Password / 确认新密码"
              />
            </div>

            {pwMsg && (
              <p className={`text-sm font-medium text-center ${pwSuccess ? 'text-green-500' : 'text-red-500'}`}>
                {pwMsg}
              </p>
            )}

            <button
              type="button"
              onClick={handleChangePassword}
              className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary shadow-lg shadow-primary/20 transition-colors hover:bg-primary-hover active:scale-[0.98]"
            >
              Confirm / 确认修改
            </button>

            <button
              type="button"
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
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
          <Lock aria-hidden="true" className="h-8 w-8 text-emphasis dark:text-primary" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">History Locked</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">历史记录需要密码查看</p>
        
        <form onSubmit={handleHistoryLogin} className="w-full max-w-xs space-y-3">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              value={historyPw}
              onChange={e => { setHistoryPw(e.target.value); setHistoryPwError(''); }}
              placeholder="Enter password / 输入密码"
              aria-label="History password / 历史记录密码"
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 pr-12 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-primary outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
            >
              {showPw ? <EyeOff aria-hidden="true" className="w-4 h-4" /> : <Eye aria-hidden="true" className="w-4 h-4" />}
            </button>
          </div>
          {historyPwError && (
            <p role="alert" className="text-red-600 dark:text-red-400 text-sm font-medium text-center">{historyPwError}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary transition-colors hover:bg-primary-hover"
          >
            Unlock / 解锁
          </button>
          <button
            type="button"
            onClick={() => setShowForgotPw(true)}
            className="min-h-11 w-full pt-4 text-center text-sm font-medium text-gray-500 transition-colors hover:text-emphasis dark:text-gray-400 dark:hover:text-primary"
          >
            Forgot Password? / 忘记密码？
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-white dark:bg-black flex flex-col">
      {/* Header */}
      <header className="pt-safe sticky top-0 z-40 border-b border-gray-200 bg-white/95 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-black/90">
        <div className="max-w-7xl mx-auto flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img
              src={APP_ICON_SRC}
              alt=""
              aria-hidden="true"
              className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/15"
            />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {settings.shopNameEn}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  收银台 · {format(new Date(), 'yyyy-MM-dd')}
                </span>
                <span className="flex items-center gap-1">
                  {isOnline ? (
                    <Wifi aria-hidden="true" className="w-3 h-3 text-green-500" />
                  ) : (
                    <WifiOff aria-hidden="true" className="w-3 h-3 text-red-500" />
                  )}
                  <span className={`text-[10px] font-bold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <button 
            type="button"
            onClick={onLogout}
            aria-label={IS_PUBLIC_DEMO ? 'Return to product home' : 'Log out and return to product home'}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-gray-600 dark:text-gray-300"
            title="Return to Home"
          >
            {IS_PUBLIC_DEMO
              ? <House aria-hidden="true" className="w-5 h-5" />
              : <LogOut aria-hidden="true" className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 pb-24">
        {activeTab === 'register' && <CashierRegister />}
        {activeTab === 'active' && <CashierActive />}
        {activeTab === 'kitchen' && <KitchenDisplay embedded />}
        {activeTab === 'edit' && <EditMenu />}
        {activeTab === 'history' && (
          hasHistoryAccess ? <CashierHistory /> : <HistoryPasswordGate />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav aria-label="Staff console navigation" className="fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-gray-200 dark:border-zinc-800 pb-safe z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-2">
          <button
            type="button"
            onClick={() => selectTab('register')}
            aria-pressed={activeTab === 'register'}
            className={`mx-1 min-h-14 flex-1 flex flex-col items-center justify-center rounded-xl py-2 gap-1 transition-colors ${
              activeTab === 'register' 
                ? 'bg-primary text-on-primary'
                : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            <Store aria-hidden="true" className={`w-6 h-6 ${activeTab === 'register' ? 'fill-current' : ''}`} />
            <span className="text-xs font-bold">Register</span>
          </button>
          
          <button
            type="button"
            onClick={() => selectTab('active')}
            aria-pressed={activeTab === 'active'}
            className={`mx-1 min-h-14 flex-1 flex flex-col items-center justify-center rounded-xl py-2 gap-1 transition-colors ${
              activeTab === 'active' 
                ? 'bg-primary text-on-primary'
                : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            <Clock aria-hidden="true" className={`w-6 h-6 ${activeTab === 'active' ? 'fill-current' : ''}`} />
            <span className="text-xs font-bold">Active</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('kitchen')}
            aria-pressed={activeTab === 'kitchen'}
            aria-label={`Kitchen display, ${kitchenOrderCount} active orders`}
            className={`relative mx-1 min-h-14 flex-1 flex flex-col items-center justify-center rounded-xl py-2 gap-1 transition-colors ${
              activeTab === 'kitchen'
                ? 'bg-primary text-on-primary'
                : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            <ChefHat aria-hidden="true" className={`w-6 h-6 ${activeTab === 'kitchen' ? 'fill-current' : ''}`} />
            <span className="text-[11px] font-bold min-[390px]:text-xs">Kitchen</span>
            {kitchenOrderCount > 0 && (
              <span className={`absolute right-1.5 top-1 min-w-5 rounded-full px-1 text-center text-[10px] font-extrabold tabular-nums ${
                activeTab === 'kitchen' ? 'bg-zinc-950 text-primary' : 'bg-red-600 text-white'
              }`}>
                {kitchenOrderCount > 99 ? '99+' : kitchenOrderCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => selectTab('history')}
            aria-pressed={activeTab === 'history'}
            className={`mx-1 min-h-14 flex-1 flex flex-col items-center justify-center rounded-xl py-2 gap-1 transition-colors ${
              activeTab === 'history' 
                ? 'bg-primary text-on-primary'
                : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            <History aria-hidden="true" className={`w-6 h-6 ${activeTab === 'history' ? 'fill-current' : ''}`} />
            <span className="text-xs font-bold">History</span>
          </button>
          
          <button
            type="button"
            onClick={() => selectTab('edit')}
            aria-pressed={activeTab === 'edit'}
            className={`mx-1 min-h-14 flex-1 flex flex-col items-center justify-center rounded-xl py-2 gap-1 transition-colors ${
              activeTab === 'edit' 
                ? 'bg-primary text-on-primary'
                : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            <Settings aria-hidden="true" className={`w-6 h-6 ${activeTab === 'edit' ? 'fill-current' : ''}`} />
            <span className="text-xs font-bold">Edit</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
