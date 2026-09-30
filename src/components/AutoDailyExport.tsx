import {useEffect, useRef} from 'react';
import {useStore} from '../store';
import {AUTO_EXPORT_EVENT, runAutomaticExport} from '../domain/auto-export';
import {isNativeApp} from '../domain/native-export';

/** Mounted once for all app routes. Only runs while the app is in the foreground. */
export default function AutoDailyExport() {
  const {orders, settings, language, ready, revision} = useStore();
  const latest = useRef({orders, settings, language, ready});
  latest.current = {orders, settings, language, ready};
  useEffect(() => {
    if (!isNativeApp()) return;
    const run = () => {const current = latest.current; if (current.ready) void runAutomaticExport(current.orders, current.settings, current.language);};
    window.addEventListener('cjpos-native-resume', run);
    window.addEventListener(AUTO_EXPORT_EVENT, run);
    document.addEventListener('visibilitychange', run);
    const periodic = setInterval(run, 60_000);
    run();
    return () => {clearInterval(periodic); window.removeEventListener('cjpos-native-resume', run); window.removeEventListener(AUTO_EXPORT_EVENT, run); document.removeEventListener('visibilitychange', run);};
  }, []);
  useEffect(() => {
    if (!ready || !isNativeApp()) return;
    const timer = setTimeout(() => {const current = latest.current; void runAutomaticExport(current.orders, current.settings, current.language);}, 10_000);
    return () => clearTimeout(timer);
  }, [ready, revision, language]);
  return null;
}
