import React, { useState } from 'react';

function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        const validEmail = import.meta.env.VITE_USER_EMAIL || 'dev@roaworld.com';
        const validPassword = import.meta.env.VITE_USER_PASSWORD || 'Wecandoit@2026';
        if (email.trim() === validEmail.trim() && password === validPassword) {
            setError('');
            onLogin();
        } else {
            setError('Invalid email or password. Please try again.');
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                {/* Logo */}
                <div className="login-logo">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="40" height="40" rx="10" fill="#2563eb" />
                        <path d="M10 20 L20 10 L30 20 L20 30 Z" fill="white" opacity="0.9" />
                        <circle cx="20" cy="20" r="5" fill="white" />
                    </svg>
                </div>

                <h1 className="login-heading">Data Hub Portal</h1>
                <p className="login-subheading">Sign in to access the reconciliation dashboard</p>

                <form onSubmit={handleSubmit} className="login-form">
                    {/* Email */}
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    {/* Password */}
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <div className="password-wrapper">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="show-password-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label="Toggle password visibility"
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {/* Error message */}
                    {error && <p className="login-error">{error}</p>}

                    <button type="submit" className="login-btn">Sign In</button>
                </form>
            </div>
        </div>
    );
}

export default Login;
