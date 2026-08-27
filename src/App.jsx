import React, { useState, useEffect } from 'react';
import Login from './login';
import Dashboard from './dashboard';
import { verifyAuthSession } from './utils/api';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('roa_auth') === 'true' && Boolean(localStorage.getItem('access_token'));
  });
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

    window.location.hash = 'reconciliation_new';
    setIsAuthenticated(true);
    setAuthChecked(true);
  };

  // ── Render Login if unauthenticated ──────────────────────────────────────
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // ── Render Dashboard once authenticated ──────────────────────────────────
  return <Dashboard setIsAuthenticated={setIsAuthenticated} authChecked={authChecked} />;
}

export default App;