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
  const handleLogin = (tokens) => {
    localStorage.setItem('roa_auth', 'true');
    if (tokens && tokens.access_token) {
      localStorage.setItem('access_token', tokens.access_token);
      if (tokens.refresh_token) {
        localStorage.setItem('refresh_token', tokens.refresh_token);
      }
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