import {useEffect, useState} from 'react';
import {CheckCircle2, Download, RefreshCw, WifiOff, X} from 'lucide-react';
import {registerSW} from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
}

export default function PwaStatus() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
      onRegisterError: (error) => console.error('[PWA] Service worker registration failed:', error),
    });
    setUpdateServiceWorker(() => update);
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
    const confirmed = window.confirm(
      'Update and reopen the app now? Finish the current order first.\n\n现在更新并重开 APP？请先完成目前订单。',
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
    ? 'Offline mode · 本机离线模式'
    : mode === 'update'
      ? 'App update ready · 新版本已准备好'
      : mode === 'install'
        ? 'Install on this phone · 安装到这台手机'
        : 'Ready to reopen offline · 已可断网重开';

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
          className="min-h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-extrabold text-on-primary transition-colors hover:bg-primary-hover"
        >
          Install
        </button>
      )}
      {mode === 'update' && (
        <button
          type="button"
          onClick={applyUpdate}
          className="min-h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-extrabold text-on-primary transition-colors hover:bg-primary-hover"
        >
          Update
        </button>
      )}
      {(mode === 'ready' || mode === 'update') && (
        <button
          type="button"
          onClick={() => mode === 'update' ? setNeedRefresh(false) : setOfflineReady(false)}
          aria-label="Dismiss / 关闭"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-300 hover:bg-zinc-800 hover:text-white"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
    </aside>
  );
}
