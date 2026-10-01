import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Store, History, Lock, Eye, EyeOff, Settings, KeyRound, ChefHat, CreditCard } from 'lucide-react';
import CashierRegister from './CashierRegister';
import CashierActive from './CashierActive';
import CashierHistory from './CashierHistory';
import EditMenu from './EditMenu';
import KitchenDisplay from './KitchenDisplay';
import { format } from 'date-fns';
import { APP_ICON_SRC } from '../brand';
import { IS_PUBLIC_DEMO } from '../demo-mode';
import { tr, localized } from '../i18n';
import LanguageSelector from './LanguageSelector';
import ShareMenu from './ShareMenu';
import ReceiveOrder from './ReceiveOrder';

const PASSWORD_KEY = 'golden_sea_laksa_admin_pw';
const DEFAULT_PASSWORD = 'admin123';
const IS_ANDROID_APP = import.meta.env.VITE_ANDROID_APP === 'true';

function getAdminPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
}

interface Props {
  onLogout: () => void;
}

type CashierTab = 'register' | 'active' | 'kitchen' | 'history' | 'edit' | 'share' | 'receive';

function getInitialCashierTab(): CashierTab {
  const routeTab = window.location.hash.split('/')[2]?.split('?')[0];
  return routeTab === 'active' || routeTab === 'kitchen' || routeTab === 'history' || routeTab === 'edit' || routeTab === 'share' || routeTab === 'receive'
    ? routeTab
    : 'register';
}

export default function CashierLayout({ onLogout }: Props) {
  const workspaceRef = useRef<HTMLDivElement>(null), headerRef = useRef<HTMLElement>(null), navigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const measure = () => {
      workspaceRef.current?.style.setProperty('--pos-header-height', `${headerRef.current?.getBoundingClientRect().height ?? 80}px`);
      workspaceRef.current?.style.setProperty('--pos-nav-height', `${navigationRef.current?.getBoundingClientRect().height ?? 80}px`);
    };
    const observer = new ResizeObserver(measure);
    if (headerRef.current) observer.observe(headerRef.current);
    if (navigationRef.current) observer.observe(navigationRef.current);
    measure(); return () => observer.disconnect();
  }, []);
  const { orders, settings, language, changeLanguage, saveStatus, ready, storageError } = useStore();
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const [activeTab, setActiveTab] = useState<CashierTab>(getInitialCashierTab);
  const [editDirty, setEditDirty] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState<string | null>(null);
  useEffect(() => {
    const updateTab = () => {
      const next = getInitialCashierTab();
      if (activeTab === 'edit' && editDirty && next !== 'edit') {
        setPendingReceipt(window.location.hash);
        window.history.replaceState(null, '', '#/cashier/edit');
        return;
      }
      setActiveTab(next);
    };
    window.addEventListener('hashchange', updateTab);
    return () => window.removeEventListener('hashchange', updateTab);
  }, [activeTab, editDirty]);
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
  const paymentDueCount = orders.filter(order => !order.paid && order.status !== 'Cancelled').length;

  const selectTab = (tab: CashierTab) => {
    if (tab !== activeTab && activeTab === 'edit' && editDirty && !window.confirm(t('Leave without saving your menu changes?', '尚未保存菜单更改，确定离开？', 'Keluar tanpa menyimpan perubahan menu?'))) return;
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
      setHistoryPwError(t('Wrong password', '密码错误', 'Kata laluan salah'));
    }
  };

  const handleChangePassword = () => {
    setPwMsg('');
    setPwSuccess(false);
    if (oldPw !== getAdminPassword()) {
      setPwMsg(t('Old password is wrong', '旧密码错误', 'Kata laluan lama salah'));
      return;
    }
    if (!newPw1 || newPw1.length < 4) {
      setPwMsg(t('New password must be at least 4 characters', '新密码至少4位', 'Kata laluan baharu mesti sekurang-kurangnya 4 aksara'));
      return;
    }
    if (newPw1 !== newPw2) {
      setPwMsg(t('Passwords do not match', '两次输入不一致', 'Kata laluan tidak sepadan'));
      return;
    }
    localStorage.setItem(PASSWORD_KEY, newPw1);
    setPwMsg(t('Password updated', '密码已更新', 'Kata laluan dikemas kini'));
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('Change password', '修改密码', 'Tukar kata laluan')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('Change the history password', '修改历史记录密码', 'Tukar kata laluan sejarah')}</p>
          
          <div className="w-full max-w-xs space-y-4">
            <div>
              <input
                type="password"
                autoComplete="current-password"
                value={oldPw}
                onChange={e => setOldPw(e.target.value)}
                aria-label={t('Old password', '旧密码', 'Kata laluan lama')}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-primary outline-none"
                placeholder={t('Old password', '旧密码', 'Kata laluan lama')}
              />
            </div>
            <div>
              <input
                type="password"
                autoComplete="new-password"
                value={newPw1}
                onChange={e => setNewPw1(e.target.value)}
                aria-label={t('New password', '新密码', 'Kata laluan baharu')}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-primary outline-none"
                placeholder={t('New password', '新密码', 'Kata laluan baharu')}
              />
            </div>
            <div>
              <input
                type="password"
                autoComplete="new-password"
                value={newPw2}
                onChange={e => setNewPw2(e.target.value)}
                aria-label={t('Confirm new password', '确认新密码', 'Sahkan kata laluan baharu')}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-primary outline-none"
                placeholder={t('Confirm new password', '确认新密码', 'Sahkan kata laluan baharu')}
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
              {t('Confirm', '确认修改', 'Sahkan')}
            </button>

            <button
              type="button"
              onClick={() => { setShowForgotPw(false); setPwMsg(''); }}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-400 font-bold rounded-xl transition-colors"
            >
              {t('Back', '返回', 'Kembali')}
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('History locked', '历史记录已锁定', 'Sejarah dikunci')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('Enter the password to view history', '请输入密码查看历史记录', 'Masukkan kata laluan untuk melihat sejarah')}</p>
        
        <form onSubmit={handleHistoryLogin} className="w-full max-w-xs space-y-3">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              value={historyPw}
              onChange={e => { setHistoryPw(e.target.value); setHistoryPwError(''); }}
              placeholder={t('Enter password', '输入密码', 'Masukkan kata laluan')}
              aria-label={t('History password', '历史记录密码', 'Kata laluan sejarah')}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 pr-12 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-primary outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? t('Hide password', '隐藏密码', 'Sembunyikan kata laluan') : t('Show password', '显示密码', 'Tunjukkan kata laluan')}
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
            {t('Unlock', '解锁', 'Buka kunci')}
          </button>
          <button
            type="button"
            onClick={() => setShowForgotPw(true)}
            className="min-h-11 w-full pt-4 text-center text-sm font-medium text-gray-500 transition-colors hover:text-emphasis dark:text-gray-400 dark:hover:text-primary"
          >
            {t('Change password', '修改密码', 'Tukar kata laluan')}
          </button>
        </form>
      </div>
    );
  };

  return (
    <div ref={workspaceRef} className="pos-workspace min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-white flex flex-col">
      {/* Header */}
      <header ref={headerRef} className="pt-safe sticky top-0 z-40 border-b border-gray-200 bg-white/95 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-black/90">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
            <img
              src={APP_ICON_SRC}
              alt=""
              aria-hidden="true"
              className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/15"
            />
            <div className="min-w-0">
              <h1 className="break-words text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {localized({ en: settings.shopNameEn, zh: settings.shopNameZh, ms: settings.shopNameMs }, language)}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('Register', '收银台', 'Daftar')} · {format(new Date(), 'yyyy-MM-dd')}
                </span>
                <span role="status" className={`text-sm font-semibold ${storageError ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {!ready ? t('Loading…', '读取中…', 'Memuatkan…') : storageError ? t('Save failed', '保存失败', 'Gagal disimpan') : saveStatus === 'saving' ? t('Saving…', '保存中…', 'Menyimpan…') : activeTab === 'edit' && editDirty ? t('Unsaved changes', '有未保存的更改', 'Perubahan belum disimpan') : t('Saved on this device', '已保存到本机', 'Disimpan pada peranti ini')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button type="button" className="min-h-12 rounded-xl border border-zinc-300 px-3 text-base font-semibold dark:border-zinc-700" onClick={() => selectTab('share')}>{t('Share menu', '分享菜单', 'Kongsi menu')}</button>
            <button type="button" className="min-h-12 rounded-xl border border-zinc-300 px-3 text-base font-semibold dark:border-zinc-700" onClick={() => selectTab('receive')}>{t('Receive receipt', '接收回单', 'Terima resit')}</button>
            <button type="button" onClick={() => {
              if (activeTab === 'edit' && editDirty && !window.confirm(t('Leave without saving your menu changes?', '尚未保存菜单更改，确定离开？', 'Keluar tanpa menyimpan perubahan menu?'))) return;
              if (IS_ANDROID_APP) onLogout(); else window.location.hash = '#/order';
            }}
              className="min-h-12 rounded-xl border border-zinc-300 px-3 text-base font-semibold text-zinc-800 hover:bg-primary/10 dark:border-zinc-700 dark:text-white">
              {t('Customer View', '顾客模式', 'Paparan pelanggan')}
            </button>
            <LanguageSelector language={language} onChange={changeLanguage} />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4" style={{ paddingBottom: 'calc(var(--pos-nav-height, 5rem) + 1rem)' }}>
        {pendingReceipt && <div role="alert" className="mb-5 space-y-3 rounded-xl bg-amber-100 p-4 text-amber-950">
          <p>{t('A receipt arrived while you have unsaved menu changes. Save your changes first, then open it.', '你有未保存的菜单更改，同时收到一个回单。请先保存，再打开回单。', 'Resit tiba semasa perubahan menu belum disimpan. Simpan perubahan dahulu, kemudian buka resit.')}</p>
          <button type="button" disabled={editDirty} className="min-h-12 rounded-xl bg-primary px-4 font-bold text-on-primary disabled:opacity-50" onClick={() => { const next = pendingReceipt; setPendingReceipt(null); window.location.hash = next; }}>{t('Open received receipt', '打开收到的回单', 'Buka resit diterima')}</button>
          <button type="button" className="min-h-12 px-4 font-bold" onClick={() => setPendingReceipt(null)}>{t('Dismiss', '稍后处理', 'Tutup')}</button>
        </div>}
        {activeTab === 'register' && <CashierRegister />}
        {activeTab === 'active' && <CashierActive />}
        {activeTab === 'kitchen' && <KitchenDisplay embedded onGoToPayments={() => selectTab('active')} />}
        {activeTab === 'edit' && <EditMenu onDirtyChange={setEditDirty} />}
        {activeTab === 'share' && <ShareMenu />}
        {activeTab === 'receive' && <ReceiveOrder />}
        {activeTab === 'history' && (
          hasHistoryAccess ? <CashierHistory /> : <HistoryPasswordGate />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav ref={navigationRef} aria-label={t('Staff navigation', '店员导航', 'Navigasi kakitangan')} className="fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-gray-200 dark:border-zinc-800 pb-safe z-40">
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
            <span className="text-sm font-bold">{t('Register', '收银台', 'Daftar')}</span>
          </button>
          
          <button
            type="button"
            onClick={() => selectTab('active')}
            aria-pressed={activeTab === 'active'}
            aria-label={t(`Payments, ${paymentDueCount} orders due`, `收款，${paymentDueCount}单待付款`, `Bayaran, ${paymentDueCount} pesanan belum dibayar`)}
            className={`relative mx-1 min-h-14 flex-1 flex flex-col items-center justify-center rounded-xl py-2 gap-1 transition-colors ${
              activeTab === 'active' 
                ? 'bg-primary text-on-primary'
                : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            <CreditCard aria-hidden="true" className={`w-6 h-6 ${activeTab === 'active' ? 'fill-current' : ''}`} />
            <span className="text-sm font-bold">{t('Pay', '收款', 'Bayar')}</span>
            {paymentDueCount > 0 && (
              <span className={`absolute right-1.5 top-1 min-w-5 rounded-full px-1 text-center text-[10px] font-extrabold tabular-nums ${
                activeTab === 'active' ? 'bg-zinc-950 text-primary' : 'bg-amber-600 text-white'
              }`}>
                {paymentDueCount > 99 ? '99+' : paymentDueCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => selectTab('kitchen')}
            aria-pressed={activeTab === 'kitchen'}
            aria-label={t(`Kitchen, ${kitchenOrderCount} active orders`, `备餐，${kitchenOrderCount}单待处理`, `Dapur, ${kitchenOrderCount} pesanan aktif`)}
            className={`relative mx-1 min-h-14 flex-1 flex flex-col items-center justify-center rounded-xl py-2 gap-1 transition-colors ${
              activeTab === 'kitchen'
                ? 'bg-primary text-on-primary'
                : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            <ChefHat aria-hidden="true" className={`w-6 h-6 ${activeTab === 'kitchen' ? 'fill-current' : ''}`} />
            <span className="text-sm font-bold">{t('Kitchen', '备餐', 'Dapur')}</span>
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
            <span className="text-sm font-bold">{t('History', '历史', 'Sejarah')}</span>
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
            <span className="text-sm font-bold">{t('Edit', '编辑', 'Sunting')}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
