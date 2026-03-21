import React, { useState, useRef } from 'react';
import { Lock, Eye, EyeOff, Store, KeyRound, Upload, Image, X } from 'lucide-react';

interface Props {
  onLogin: () => void;
}

const PASSWORD_KEY = 'golden_sea_laksa_admin_pw';
const QR_IMAGE_KEY = 'golden_sea_laksa_qr_image';
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
  // QR image upload
  const [showQrUpload, setShowQrUpload] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(
    localStorage.getItem(QR_IMAGE_KEY)
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      localStorage.setItem(QR_IMAGE_KEY, base64);
      setQrPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveQr = () => {
    localStorage.removeItem(QR_IMAGE_KEY);
    setQrPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---- Forget Password View ----
  if (showForgotPw) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-orange-500/20">
              <KeyRound className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white mb-1">Change Password</h1>
            <p className="text-zinc-500 text-sm font-medium">修改密码</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">旧密码 / Old Password</label>
              <input
                type="password"
                value={oldPw}
                onChange={e => setOldPw(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-white font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Enter old password"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">新密码 / New Password</label>
              <input
                type="password"
                value={newPw1}
                onChange={e => setNewPw1(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-white font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">确认新密码 / Confirm Password</label>
              <input
                type="password"
                value={newPw2}
                onChange={e => setNewPw2(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-white font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Re-enter new password"
              />
            </div>

            {pwMsg && (
              <p className={`text-sm font-medium text-center ${pwSuccess ? 'text-green-400' : 'text-red-400'}`}>
                {pwMsg}
              </p>
            )}

            <button
              onClick={handleChangePassword}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl transition-all text-lg shadow-lg shadow-orange-500/20 active:scale-[0.98]"
            >
              Confirm / 确认修改
            </button>

            <button
              onClick={() => { setShowForgotPw(false); setPwMsg(''); }}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold rounded-xl transition-colors"
            >
              Back / 返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- QR Image Upload View ----
  if (showQrUpload) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-500/20">
              <Image className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white mb-1">QR Payment Image</h1>
            <p className="text-zinc-500 text-sm font-medium">上传付款二维码</p>
          </div>

          <div className="space-y-4">
            {qrPreview ? (
              <div className="relative bg-white rounded-2xl p-4">
                <img src={qrPreview} alt="QR Code" className="w-full max-h-64 object-contain mx-auto rounded-xl" />
                <button
                  onClick={handleRemoveQr}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
              >
                <Upload className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
                <p className="text-zinc-400 font-bold">Click to upload QR image</p>
                <p className="text-zinc-600 text-sm mt-1">点击上传二维码图片</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleQrUpload}
              className="hidden"
            />

            {!qrPreview && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all text-lg shadow-lg active:scale-[0.98]"
              >
                <Upload className="w-5 h-5 inline mr-2" />
                Upload / 上传
              </button>
            )}

            <button
              onClick={() => setShowQrUpload(false)}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold rounded-xl transition-colors"
            >
              Back / 返回
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <button
            onClick={() => setShowQrUpload(true)}
            className="text-center text-zinc-500 hover:text-blue-400 text-sm font-medium transition-colors"
          >
            📷 Upload QR Image / 上传付款二维码
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
