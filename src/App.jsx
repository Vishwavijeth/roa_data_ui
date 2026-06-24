import React, { useState } from 'react';
import Login from './login';
import Dashboard from './dashboard';
import './App.css';

function App() {
  // ── Auth state (persisted via sessionStorage) ────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('roa_auth') === 'true'
  );

  // ── Auth handler ─────────────────────────────────────────────────────────
  const handleLogin = (tokens) => {
    sessionStorage.setItem('roa_auth', 'true');
    if (tokens && tokens.access_token) {
      sessionStorage.setItem('access_token', tokens.access_token);
      sessionStorage.setItem('refresh_token', tokens.refresh_token);
    }
    setIsAuthenticated(true);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard setIsAuthenticated={setIsAuthenticated} />;
}

export default App;