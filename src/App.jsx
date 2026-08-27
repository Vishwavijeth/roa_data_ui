import React, { useState, useEffect } from 'react';
import Login from './login';
import Dashboard from './dashboard';
import { verifyAuthSession } from './utils/api';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // ── Verify session BEFORE mounting page APIs ──────────────────────────────
  useEffect(() => {
    let isMounted = true;
    verifyAuthSession().then((isAuth) => {
      if (isMounted) {
        setIsAuthenticated(isAuth);
        setAuthChecked(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Auth handler ─────────────────────────────────────────────────────────
  const handleLogin = (data) => {
    localStorage.setItem('roa_auth', 'true');
    const accessToken = data?.token?.access_token || data?.access_token;
    const refreshToken = data?.token?.refresh_token || data?.refresh_token;

    if (accessToken) {
      localStorage.setItem('access_token', accessToken);
    }
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
    if (data?.role) {
      localStorage.setItem('user_role', JSON.stringify(data.role));
    }
    if (data?.email) {
      localStorage.setItem('user_email', data.email);
    }

    setIsAuthenticated(true);
    setAuthChecked(true);
  };

  // ── 1. Show loading screen while checking initial auth session ───────────
  if (!authChecked) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium animate-pulse">Verifying session...</p>
        </div>
      </div>
    );
  }

  // ── 2. Render Login if unauthenticated ───────────────────────────────────
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // ── 3. Render Dashboard once authenticated ───────────────────────────────
  return <Dashboard setIsAuthenticated={setIsAuthenticated} authChecked={authChecked} />;
}

export default App;