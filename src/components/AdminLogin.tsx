import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { APP_ICON_SRC } from '../brand';

interface Props {
  onLogin: () => void;
}

const PASSWORD_KEY = 'golden_sea_laksa_admin_pw';
const DEFAULT_PASSWORD = 'admin123';

function getAdminPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
}

export default function AdminLogin({ onLogin }: Props) {
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
      setError('密码错误 / Wrong password');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  // ---- Main Login View ----
  return (
    <div className="min-h-dvh bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-sm transition-transform ${isShaking ? 'animate-shake' : ''}`}
        style={isShaking ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={APP_ICON_SRC} alt="CJ F&B POS app icon" className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover shadow-2xl shadow-black/30" />
          <h1 className="text-2xl font-extrabold text-white mb-1">CJ F&amp;B POS</h1>
          <p className="text-zinc-300 text-sm font-medium">Staff Login / 员工登录</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="staff-password" className="block text-sm font-bold text-zinc-300 mb-2">
              Password / 密码
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
                placeholder="Enter password"
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl pl-12 pr-12 py-4 text-white text-lg font-medium focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-zinc-500"
                autoComplete="current-password"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'staff-password-error' : 'staff-access-note'}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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
            Login / 登录
          </button>
        </form>

        <p id="staff-access-note" className="text-center text-zinc-400 text-xs leading-5 mt-6">
          Local device access only · 本机入口，不是 Cloud 安全账号
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
