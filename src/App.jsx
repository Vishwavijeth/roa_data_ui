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
  const handleLogin = () => {
    sessionStorage.setItem('roa_auth', 'true');
    setIsAuthenticated(true);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard setIsAuthenticated={setIsAuthenticated} />;
}

export default App;