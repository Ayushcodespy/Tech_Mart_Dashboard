import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';

import { appConfig } from '../config';
import { authApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { login, getErrorMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = new URLSearchParams(location.search).get('next') || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [resetForm, setResetForm] = useState({ email: '', code: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('login');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  const isForgotPassword = mode === 'forgotPassword';

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      if (isForgotPassword) {
        if (!resetCodeSent) {
          await authApi.forgotPassword({ email: resetForm.email });
          setMessage('Password reset code sent to your email.');
          setResetCodeSent(true);
          return;
        }
        if (!resetForm.code.trim()) {
          throw new Error('Reset code is required');
        }
        if (resetForm.password.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
        if (resetForm.password !== resetForm.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await authApi.resetPassword({
          email: resetForm.email,
          code: resetForm.code.trim(),
          new_password: resetForm.password,
        });
        setMessage('Password reset successful. Sign in with your new password.');
        setMode('login');
        setForm((prev) => ({ ...prev, email: resetForm.email, password: '' }));
        setResetForm({ email: resetForm.email, code: '', password: '', confirmPassword: '' });
        setResetCodeSent(false);
      } else {
        await login(form);
        navigate(next, { replace: true });
      }
    } catch (err) {
      const message = getErrorMessage(err);
      if (message.toLowerCase().includes('invalid')) {
        setError('Invalid credentials. Please check email and password.');
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#eaf8d8_0,#f4f7fb_35%)] p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <p className="text-xs uppercase tracking-widest text-brand-600">{appConfig.appName}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{isForgotPassword ? 'Reset Password' : 'Admin Sign In'}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {isForgotPassword
            ? resetCodeSent
              ? 'Enter the code from your email and choose a new password.'
              : 'Enter your email to receive a reset code.'
            : 'Access operations dashboard and control center.'}
        </p>

        <form className="mt-8 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-600">
            Email
            <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3">
              <Mail size={16} className="text-slate-400" />
              <input
                type="email"
                required
                className="w-full border-0 bg-transparent px-2 py-3 text-sm text-slate-900 outline-none"
                placeholder="admin@example.com"
                value={isForgotPassword ? resetForm.email : form.email}
                onChange={(e) =>
                  isForgotPassword
                    ? setResetForm((prev) => ({ ...prev, email: e.target.value }))
                    : setForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
          </label>

          {!isForgotPassword || resetCodeSent ? (
          <label className="block text-sm font-medium text-slate-600">
            {isForgotPassword ? 'New Password' : 'Password'}
            <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3">
              <LockKeyhole size={16} className="text-slate-400" />
              <input
                type={isForgotPassword ? (showResetPassword ? 'text' : 'password') : showPassword ? 'text' : 'password'}
                required
                minLength={8}
                className="w-full border-0 bg-transparent px-2 py-3 text-sm text-slate-900 outline-none"
                placeholder="********"
                value={isForgotPassword ? resetForm.password : form.password}
                onChange={(e) =>
                  isForgotPassword
                    ? setResetForm((prev) => ({ ...prev, password: e.target.value }))
                    : setForm((prev) => ({ ...prev, password: e.target.value }))
                }
              />
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"
                onClick={() =>
                  isForgotPassword
                    ? setShowResetPassword((prev) => !prev)
                    : setShowPassword((prev) => !prev)
                }
                aria-label={isForgotPassword ? (showResetPassword ? 'Hide password' : 'Show password') : showPassword ? 'Hide password' : 'Show password'}
              >
                {isForgotPassword ? (
                  showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />
                ) : showPassword ? (
                  <EyeOff size={16} />
                ) : (
                  <Eye size={16} />
                )}
              </button>
            </div>
          </label>
          ) : null}

          {isForgotPassword && resetCodeSent ? (
            <label className="block text-sm font-medium text-slate-600">
              Reset Code
              <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3">
                <LockKeyhole size={16} className="text-slate-400" />
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  className="w-full border-0 bg-transparent px-2 py-3 text-sm text-slate-900 outline-none"
                  placeholder="6 digit code"
                  value={resetForm.code}
                  onChange={(e) => setResetForm((prev) => ({ ...prev, code: e.target.value }))}
                />
              </div>
            </label>
          ) : null}

          {isForgotPassword && resetCodeSent ? (
            <label className="block text-sm font-medium text-slate-600">
              Confirm Password
              <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3">
                <LockKeyhole size={16} className="text-slate-400" />
                <input
                  type={showResetConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  className="w-full border-0 bg-transparent px-2 py-3 text-sm text-slate-900 outline-none"
                  placeholder="********"
                  value={resetForm.confirmPassword}
                  onChange={(e) => setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                />
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"
                  onClick={() => setShowResetConfirmPassword((prev) => !prev)}
                  aria-label={showResetConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showResetConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          ) : null}
          {message ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" /> : null}
            {submitting ? 'Please wait...' : isForgotPassword ? resetCodeSent ? 'Reset Password' : 'Send Reset Code' : 'Sign In'}
          </button>

          <button
            type="button"
            className="w-full text-sm font-medium text-slate-600 hover:text-slate-900"
            onClick={() => {
              setError('');
              setMessage('');
              setResetCodeSent(false);
              setMode((prev) => (prev === 'forgotPassword' ? 'login' : 'forgotPassword'));
            }}
          >
            {isForgotPassword ? 'Back to sign in' : 'Forgot password?'}
          </button>
        </form>
      </div>
    </div>
  );
};
