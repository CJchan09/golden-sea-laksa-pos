import React, { useState, useRef } from 'react';
import { Lock, Eye, EyeOff, Store, KeyRound, X } from 'lucide-react';

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
  // Forget password state
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw1, setNewPw1] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

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

  // ---- Main Login View ----
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-sm transition-transform ${isShaking ? 'animate-shake' : ''}`}
        style={isShaking ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-orange-500/20">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-1">Golden Sea Laksa</h1>
          <p className="text-zinc-500 text-sm font-medium">Staff Login / 员工登录</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-zinc-400 mb-2">
              Password / 密码
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-5 h-5 text-zinc-500" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter password"
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl pl-12 pr-12 py-4 text-white text-lg font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all placeholder:text-zinc-600"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {error && (
              <p className="text-red-400 text-sm font-medium mt-2 flex items-center gap-1">
                ⚠️ {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl transition-all text-lg shadow-lg shadow-orange-500/20 active:scale-[0.98]"
          >
            Login / 登录
          </button>
        </form>

        {/* Bottom Links */}
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => setShowForgotPw(true)}
            className="text-center text-zinc-500 hover:text-orange-400 text-sm font-medium transition-colors"
          >
            🔑 Forget Password / 忘记密码
          </button>
        </div>

        <p className="text-center text-zinc-600 text-xs mt-6">
          Golden Sea Laksa POS System
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
