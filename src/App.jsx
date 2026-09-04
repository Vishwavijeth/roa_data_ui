import React, { useState, useEffect } from 'react';
import Login from './login';
import Dashboard from './dashboard';
import { verifyAuthSession, storeTokens, clearSession } from './utils/api';
import { API_DOMAIN } from './constants';
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
    return () => { isMounted = false; };
  }, []);

  // ── Auth handler ──────────────────────────────────────────────────────────
  const handleLogin = async (data) => {
    // Store both tokens from the flat login response
    storeTokens(data);
    localStorage.setItem('roa_auth', 'true');

    // Fetch user info (role, email) from /auth/me using the new access token
    const accessToken = data.token?.access_token || data.access_token;
    if (accessToken) {
      try {
        const meRes = await fetch(`${API_DOMAIN}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData?.is_active === false) {
            // Account is inactive → reject login
            clearSession();
            return;
          }
          if (meData?.role)  localStorage.setItem('user_role',  JSON.stringify(meData.role));
          if (meData?.email) localStorage.setItem('user_email', meData.email);
        }
      } catch (err) {
        console.warn('[Auth] /auth/me after login failed:', err.message);
        // Non-fatal – proceed with login; role info may be missing but tokens are stored
      }
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