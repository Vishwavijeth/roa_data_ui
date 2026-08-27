import React, { useState } from 'react';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { API_DOMAIN } from './constants';

function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Forgot password state
    const [forgotMode, setForgotMode] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);
    const [resetError, setResetError] = useState('');

    // Reset Token / Set New Password state from URL
    const [resetToken, setResetToken] = useState(() => {
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        let token = new URLSearchParams(search).get('token');
        if (!token && hash.includes('?')) {
            token = new URLSearchParams(hash.split('?')[1]).get('token');
        }
        return token;
    });

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [newPasswordLoading, setNewPasswordLoading] = useState(false);
    const [newPasswordSuccess, setNewPasswordSuccess] = useState(false);
    const [newPasswordError, setNewPasswordError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_DOMAIN}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim(),
                    password: password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                if (data.access_token) {
                    onLogin(data);
                } else {
                    setError('Invalid server response. Please try again.');
                    setLoading(false);
                }
            } else {
                const errorMessage = data.detail || 'Invalid email or password';
                setError(errorMessage);
                setLoading(false);
            }
        } catch (err) {
            setError('Failed to connect to the authentication server. Please check your connection and try again.');
            setLoading(false);
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setResetLoading(true);
        setResetError('');

        try {
            const response = await fetch(`${API_DOMAIN}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: resetEmail.trim(),
                }),
            });

            if (response.ok) {
                setResetSuccess(true);
            } else {
                const data = await response.json().catch(() => ({}));
                setResetSuccess(true);
            }
        } catch (err) {
            setResetSuccess(true);
        } finally {
            setResetLoading(false);
        }
    };

    const handleSetNewPassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setNewPasswordError('Passwords do not match.');
            return;
        }

        setNewPasswordLoading(true);
        setNewPasswordError('');

        try {
            const response = await fetch(`${API_DOMAIN}/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: resetToken,
                    new_password: newPassword,
                }),
            });

            const data = await response.json();
            if (response.ok) {
                setNewPasswordSuccess(true);
            } else {
                setNewPasswordError(data.detail || 'Failed to reset password. Token may be expired or invalid.');
            }
        } catch (err) {
            setNewPasswordError('Unable to connect to server. Please try again later.');
        } finally {
            setNewPasswordLoading(false);
        }
    };

    const clearResetUrlAndGoToLogin = () => {
        setResetToken(null);
        setForgotMode(false);
        window.location.hash = '';
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden px-4">
            {/* Background design elements */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-100/40 blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-100/40 blur-3xl" />

            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-xl p-8 z-10 relative">

                {resetToken ? (
                    <>
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Set New Password</h1>
                            <p className="text-sm text-slate-500 mt-1.5">
                                {newPasswordSuccess
                                    ? "Your password has been updated"
                                    : "Enter your new password below"}
                            </p>
                        </div>

                        {newPasswordSuccess ? (
                            <div className="space-y-6 text-center">
                                <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                                    Your password has been reset successfully. You can now sign in with your new password.
                                </div>
                                <Button
                                    type="button"
                                    className="w-full py-2 h-10 font-semibold"
                                    onClick={clearResetUrlAndGoToLogin}
                                >
                                    Proceed to Sign In
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSetNewPassword} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider" htmlFor="newPassword">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <Input
                                            id="newPassword"
                                            type={showNewPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            minLength={6}
                                            className="w-full pr-10"
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            {showNewPassword ? (
                                                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider" htmlFor="confirmPassword">
                                        Confirm Password
                                    </label>
                                    <Input
                                        id="confirmPassword"
                                        type={showNewPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="w-full"
                                    />
                                </div>

                                {newPasswordError && (
                                    <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs font-medium flex items-center gap-2">
                                        <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span>{newPasswordError}</span>
                                    </div>
                                )}

                                <Button type="submit" className="w-full flex justify-center py-2 h-10 shadow-lg shadow-blue-600/10 font-semibold" disabled={newPasswordLoading}>
                                    {newPasswordLoading ? (
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </Button>

                                <div className="text-center pt-2">
                                    <button
                                        type="button"
                                        onClick={clearResetUrlAndGoToLogin}
                                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline focus:outline-none transition-colors"
                                    >
                                        ← Back to Sign In
                                    </button>
                                </div>
                            </form>
                        )}
                    </>
                ) : !forgotMode ? (
                    <>
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ROA Data Portal</h1>
                            <p className="text-sm text-slate-500 mt-1.5">Sign in to access the reconciliation dashboard</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider" htmlFor="email">
                                    Email Address
                                </label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@roaworld.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    className="w-full"
                                />
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider" htmlFor="password">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForgotMode(true);
                                            setResetEmail(email);
                                            setResetError('');
                                            setResetSuccess(false);
                                        }}
                                        className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline focus:outline-none transition-colors"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                        className="w-full pr-10"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label="Toggle password visibility"
                                    >
                                        {showPassword ? (
                                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs font-medium flex items-center gap-2">
                                    <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            )}

                            <Button type="submit" className="w-full flex justify-center py-2 h-10 shadow-lg shadow-blue-600/10 font-semibold" disabled={loading}>
                                {loading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>
                    </>
                ) : (
                    <>
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset Password</h1>
                            <p className="text-sm text-slate-500 mt-1.5">
                                {resetSuccess
                                    ? "Check your inbox for instructions"
                                    : "Enter your registered email address to receive reset instructions"}
                            </p>
                        </div>

                        {resetSuccess ? (
                            <div className="space-y-6 text-center">
                                <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                                    If an account exists for <strong className="text-slate-800">{resetEmail}</strong>, you will receive an email with instructions to reset your password shortly.
                                </div>
                                <Button
                                    type="button"
                                    className="w-full py-2 h-10 font-semibold"
                                    onClick={() => setForgotMode(false)}
                                >
                                    Back to Sign In
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleResetSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider" htmlFor="resetEmail">
                                        Email Address
                                    </label>
                                    <Input
                                        id="resetEmail"
                                        type="email"
                                        placeholder="you@roaworld.com"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className="w-full"
                                    />
                                </div>

                                {resetError && (
                                    <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs font-medium flex items-center gap-2">
                                        <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span>{resetError}</span>
                                    </div>
                                )}

                                <Button type="submit" className="w-full flex justify-center py-2 h-10 shadow-lg shadow-blue-600/10 font-semibold" disabled={resetLoading}>
                                    {resetLoading ? (
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    ) : (
                                        'Send Reset Link'
                                    )}
                                </Button>

                                <div className="text-center pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setForgotMode(false)}
                                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline focus:outline-none transition-colors"
                                    >
                                        ← Back to Sign In
                                    </button>
                                </div>
                            </form>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default Login;
