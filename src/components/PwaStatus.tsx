import {useEffect, useState} from 'react';
import {CheckCircle2, Download, RefreshCw, WifiOff, X} from 'lucide-react';
import {registerSW} from 'virtual:pwa-register';
import {useStore} from '../store';
import {tr} from '../i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
}

export default function PwaStatus() {
  const {language, saveStatus} = useStore();
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    let registration: ServiceWorkerRegistration | undefined;
    const checkUpdate = () => {
      if (navigator.onLine) void registration?.update().catch(error => console.warn('[PWA] Update check failed:', error));
    };
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
      onRegisteredSW: (_url, registered) => { registration = registered; checkUpdate(); },
      onRegisterError: (error) => console.error('[PWA] Service worker registration failed:', error),
    });
    setUpdateServiceWorker(() => update);
    window.addEventListener('focus', checkUpdate);
    window.addEventListener('online', checkUpdate);
    return () => {
      window.removeEventListener('focus', checkUpdate);
      window.removeEventListener('online', checkUpdate);
    };
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!offlineReady) return;
    const timeout = window.setTimeout(() => setOfflineReady(false), 6000);
    return () => window.clearTimeout(timeout);
  }, [offlineReady]);

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null);
      try {
        await navigator.storage?.persist?.();
      } catch (error) {
        console.warn('[PWA] Persistent storage request was not available:', error);
      }
    }
  };

  const applyUpdate = async () => {
    if (saveStatus === 'saving') return;
    const confirmed = window.confirm(
      t('Update and reopen now? Save menu edits and finish the current order first. Your saved local data will stay on this device.',
        '现在更新并重开？请先保存菜单修改、完成当前订单。已保存的本机资料会保留。',
        'Kemas kini dan buka semula sekarang? Simpan perubahan menu dan selesaikan pesanan semasa dahulu. Data tempatan yang disimpan kekal pada peranti ini.'),
    );
    if (!confirmed || !updateServiceWorker) return;
    await updateServiceWorker(true);
  };

  const mode = !isOnline
    ? 'offline'
    : needRefresh
      ? 'update'
      : installPrompt
        ? 'install'
        : offlineReady
          ? 'ready'
          : null;

  if (!mode) return null;

  const icon = mode === 'offline'
    ? <WifiOff aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
    : mode === 'update'
      ? <RefreshCw aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
      : mode === 'install'
        ? <Download aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
        : <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-green-400" />;

  const copy = mode === 'offline'
    ? t('Offline mode', '本机离线模式', 'Mod luar talian')
    : mode === 'update'
      ? t('App update ready', '新版本已准备好', 'Kemas kini aplikasi tersedia')
      : mode === 'install'
        ? t('Install on this device', '安装到这台设备', 'Pasang pada peranti ini')
        : t('Ready to reopen offline', '已可断网重开', 'Sedia dibuka semula di luar talian');

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] z-[100] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white shadow-2xl shadow-black/40"
    >
      {icon}
      <p className="min-w-0 flex-1 text-sm font-bold leading-snug">{copy}</p>
      {mode === 'install' && (
        <button
          type="button"
          onClick={installApp}
          className="min-h-12 shrink-0 rounded-xl bg-primary px-4 text-sm font-extrabold text-on-primary transition-colors hover:bg-primary-hover"
        >
          {t('Install', '安装', 'Pasang')}
        </button>
      )}
      {mode === 'update' && (
        <button
          type="button"
          onClick={applyUpdate}
          disabled={saveStatus === 'saving'}
          className="min-h-12 shrink-0 rounded-xl bg-primary px-4 text-sm font-extrabold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {t('Update', '更新', 'Kemas kini')}
        </button>
      )}
      {(mode === 'ready' || mode === 'update' || mode === 'install') && (
        <button
          type="button"
          onClick={() => mode === 'update' ? setNeedRefresh(false) : mode === 'install' ? setInstallPrompt(null) : setOfflineReady(false)}
          aria-label={t('Dismiss', '关闭', 'Tutup')}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-zinc-300 hover:bg-zinc-800 hover:text-white"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
    </aside>
  );
}
