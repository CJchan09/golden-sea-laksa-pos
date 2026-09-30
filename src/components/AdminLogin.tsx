import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { APP_ICON_SRC } from '../brand';
import { useStore } from '../store';
import { tr } from '../i18n';
import LanguageSelector from './LanguageSelector';

interface Props {
  onLogin: () => void;
}

const PASSWORD_KEY = 'golden_sea_laksa_admin_pw';
const DEFAULT_PASSWORD = 'admin123';

function getAdminPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
}

export default function AdminLogin({ onLogin }: Props) {
  const { language, changeLanguage } = useStore();
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === getAdminPassword()) {
      sessionStorage.setItem('golden_sea_admin_auth', 'true');
      onLogin();
    } else {
      setError(t('Wrong password', '密码错误', 'Kata laluan salah'));
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  // ---- Main Login View ----
  return (
    <div className="pos-workspace min-h-dvh bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-sm transition-transform ${isShaking ? 'animate-shake' : ''}`}
        style={isShaking ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={APP_ICON_SRC} alt="CJ F&B POS app icon" className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover shadow-2xl shadow-black/30" />
          <h1 className="text-2xl font-extrabold text-white mb-1">CJ F&amp;B POS</h1>
          <p className="text-zinc-300 text-sm font-medium">{t("Staff login", "员工登录", "Log masuk kakitangan")}</p>
          <div className="mt-4"><LanguageSelector language={language} onChange={changeLanguage} /></div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="staff-password" className="block text-sm font-bold text-zinc-300 mb-2">
              {t('Password', '密码', 'Kata laluan')}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-5 h-5 text-zinc-500" />
              </div>
              <input
                id="staff-password"
                name="staff-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder={t("Enter password", "输入密码", "Masukkan kata laluan")}
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl pl-12 pr-12 py-4 text-white text-lg font-medium focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-zinc-500"
                autoComplete="current-password"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'staff-password-error' : 'staff-access-note'}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('Hide password', '隐藏密码', 'Sembunyikan kata laluan') : t('Show password', '显示密码', 'Tunjukkan kata laluan')}
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
              </button>
            </div>
            {error && (
              <p id="staff-password-error" role="alert" className="text-red-300 text-sm font-medium mt-2 flex items-center gap-1">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl transition-colors text-lg shadow-lg shadow-black/25 active:scale-[0.98]"
          >
            {t('Login', '登录', 'Log masuk')}
          </button>
        </form>

        <p id="staff-access-note" className="text-center text-zinc-400 text-xs leading-5 mt-6">
          {t('Access to this device only', '仅用于本机访问', 'Akses kepada peranti ini sahaja')}
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}
      </style>
    </div>
  );
}
