import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { utils, writeFile } from 'xlsx';
import './App.css';

function LoginPage({ onLogin }) {
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
        <div className="login-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="#2563eb"/>
            <path d="M10 20 L20 10 L30 20 L20 30 Z" fill="white" opacity="0.9"/>
            <circle cx="20" cy="20" r="5" fill="white"/>
          </svg>
        </div>
        <h1 className="login-heading">Data Hub Portal</h1>
        <p className="login-subheading">Sign in to access the reconciliation dashboard</p>
        <form onSubmit={handleSubmit} className="login-form">
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
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn">Sign In</button>
        </form>
      </div>
    </div>
  );
}

const PARAMETERS = [
  { id: 'saleprice', label: 'Sale Price' },
  { id: 'close_date', label: 'Close Date' },
  { id: 'listingprice', label: 'Listing Price' },
  { id: 'contract_date', label: 'Contract Date' },
  { id: 'listingguid', label: 'Listing Guid' },
  { id: 'buyer_name', label: 'Buyer Name' },
  { id: 'seller_name', label: 'Seller Name' },
  { id: 'buying_agent_name', label: 'Buying Agent Name' },
  { id: 'gross_commission', label: 'Gross Commission' },
  { id: 'reviewer_specialist', label: 'Reviewer & Specialist' },
];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('roa_auth') === 'true'
  );
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeParam, setActiveParam] = useState(PARAMETERS[0]);
  const [page, setPage] = useState(1);
  const [showOnlyMismatches, setShowOnlyMismatches] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [specialistFilter, setSpecialistFilter] = useState('');
  const [reviewerFilter, setReviewerFilter] = useState('');

  const rowsPerPage = 50;

  useEffect(() => {
    fetch('/consolidated_report.csv')
      .then(res => res.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setData(results.data);
            setLoading(false);
          }
        });
      })
      .catch(err => {
        console.error("Failed to fetch CSV", err);
        setLoading(false);
      });
  }, []);

  const stats = useMemo(() => {
    if (!data.length) return { total: 0, matchPct: 0, mismatchPct: 0 };
    let totalFields = 0;
    let matchFields = 0;
    data.forEach(row => {
      PARAMETERS.forEach(p => {
        const resultKey = `${p.id}_result`;
        if (row[resultKey]) {
          totalFields++;
          if (row[resultKey].toLowerCase() === 'match') matchFields++;
        }
      });
    });
    const matchPct = totalFields ? ((matchFields / totalFields) * 100).toFixed(1) : 0;
    const mismatchPct = totalFields ? (((totalFields - matchFields) / totalFields) * 100).toFixed(1) : 0;
    return { total: data.length, matchPct, mismatchPct };
  }, [data]);

  const getRowKeys = (param) => {
    switch (param.id) {
      case 'saleprice': return { skyslope: 'skyslope_saleprice', be: 'be_sale_price', result: 'saleprice_result' };
      case 'close_date': return { skyslope: 'skyslope_escrowclosingdate', be: 'be_closed_date', result: 'close_date_result' };
      case 'listingprice': return { skyslope: 'skyslope_listingprice', be: 'be_listing_price', result: 'listingprice_result' };
      case 'contract_date': return { skyslope: 'skyslope_contractacceptancedate', be: 'be_contract_date', result: 'contract_date_result' };
      case 'listingguid': return { skyslope: 'skyslope_listingguid', be: 'be_listingguid', result: 'listingguid_result' };
      case 'buyer_name': return { skyslope: 'skyslope_buyer_name', be: 'be_buyer_name', result: 'buyer_name_result' };
      case 'seller_name': return { skyslope: 'skyslope_seller_name', be: 'be_seller_name', result: 'seller_name_result' };
      case 'buying_agent_name': return { skyslope: 'skyslope_buying_agent_name', be: 'be_buying_agent_name', result: 'buying_agent_name_result' };
      case 'gross_commission': return { skyslope: 'skyslope_gross_commission', be: 'be_gross_commission', result: 'gross_commission_result' };
      case 'reviewer_specialist': return { skyslope: 'skyslope_reviewer_name', be: 'be_transaction_specialist', result: '' };
      default: return { skyslope: '', be: '', result: '' };
    }
  };

  const currentKeys = getRowKeys(activeParam);

  // Unique options for specialist & reviewer dropdowns
  const uniqueSpecialists = useMemo(() => {
    const vals = new Set(data.map(r => r.be_transaction_specialist).filter(Boolean));
    return [...vals].sort();
  }, [data]);

  const uniqueReviewers = useMemo(() => {
    const vals = new Set(data.map(r => r.skyslope_reviewer_name).filter(Boolean));
    return [...vals].sort();
  }, [data]);

  const filteredData = useMemo(() => {
    let result = data;

    if (showOnlyMismatches) {
      result = result.filter(row => {
        const resultVal = row[currentKeys.result] ? row[currentKeys.result].toLowerCase() : '';
        return resultVal === 'mismatch';
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(row =>
        (row.transactionId || '').toLowerCase().includes(q) ||
        (row.saleGuid || '').toLowerCase().includes(q) ||
        (row.property_address || '').toLowerCase().includes(q)
      );
    }

    if (specialistFilter) {
      result = result.filter(row => row.be_transaction_specialist === specialistFilter);
    }

    if (reviewerFilter) {
      result = result.filter(row => row.skyslope_reviewer_name === reviewerFilter);
    }

    return result;
  }, [data, showOnlyMismatches, currentKeys, searchQuery, specialistFilter, reviewerFilter]);

  const mismatchCount = useMemo(() => {
    return data.filter(row => {
      const resultVal = row[currentKeys.result] ? row[currentKeys.result].toLowerCase() : '';
      return resultVal === 'mismatch';
    }).length;
  }, [data, currentKeys]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const handleDownload = () => {
    const worksheet = utils.json_to_sheet(data);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Master Report");
    writeFile(workbook, `ROA master report.xlsx`);
  };

  // All hooks done — now safe to do early conditional returns
  if (!isAuthenticated) {
    return <LoginPage onLogin={() => { sessionStorage.setItem('roa_auth', 'true'); setIsAuthenticated(true); }} />;
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading Data...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="header-actions">
        <div>
          <h1>Data Hub Portal</h1>
          <p>Transaction reconciliation overview across Brokerage Engine and SkySlope.</p>
        </div>
        <div className="header-buttons">
          <button className="export-btn" onClick={handleDownload}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Master Report
          </button>
          <button className="logout-btn" onClick={() => { sessionStorage.removeItem('roa_auth'); setIsAuthenticated(false); }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      <div className="metrics-container">
        <div className="metric-card">
          <h3>Total Records</h3>
          <p className="value">{stats.total.toLocaleString()}</p>
        </div>
        <div className="metric-card">
          <h3>Match Percentage</h3>
          <p className="value success">{stats.matchPct}%</p>
        </div>
        <div className="metric-card">
          <h3>Mismatch Percentage</h3>
          <p className="value danger">{stats.mismatchPct}%</p>
        </div>
      </div>

      <div className="parameters-section">
        <h2>Comparison Parameters</h2>
        <div className="chips-container">
          {PARAMETERS.map(param => (
            <button
              key={param.id}
              className={`chip ${activeParam.id === param.id ? 'active' : ''}`}
              onClick={() => { setActiveParam(param); setPage(1); }}
            >
              {param.label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2>{activeParam.label} Comparison</h2>
            <div className="mismatch-toggle-group">
              <button
                className={`toggle-btn ${showOnlyMismatches ? 'active' : ''}`}
                onClick={() => { setShowOnlyMismatches(!showOnlyMismatches); setPage(1); }}
              >
                Show Only Mismatches
              </button>
              <span className="mismatch-count-badge">{mismatchCount}</span>
            </div>
          </div>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Showing page {page} of {totalPages || 1}
          </span>
        </div>

        {/* ── Search & Filter Bar (inside table card) ── */}
        <div className="search-filter-bar">
          <div className="search-input-wrapper">
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              id="table-search"
              type="text"
              className="search-input"
              placeholder="Search by Transaction ID, Sale Guid, or Property Address…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => { setSearchQuery(''); setPage(1); }} aria-label="Clear search">✕</button>
            )}
          </div>

          <div className="filter-group">
            <label htmlFor="specialist-filter" className="filter-label">Transaction Specialist</label>
            <select
              id="specialist-filter"
              className="filter-select"
              value={specialistFilter}
              onChange={e => { setSpecialistFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Specialists</option>
              {uniqueSpecialists.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="reviewer-filter" className="filter-label">Reviewer</label>
            <select
              id="reviewer-filter"
              className="filter-select"
              value={reviewerFilter}
              onChange={e => { setReviewerFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Reviewers</option>
              {uniqueReviewers.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {(searchQuery || specialistFilter || reviewerFilter) && (
            <button className="clear-all-btn" onClick={() => { setSearchQuery(''); setSpecialistFilter(''); setReviewerFilter(''); setPage(1); }}>
              Clear All
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Sale Guid</th>
                <th>Transaction ID</th>
                <th>Property Address</th>
                {activeParam.id === 'reviewer_specialist' ? (
                  <>
                    <th>SkySlope Reviewer</th>
                    <th>BE Transaction Specialist</th>
                  </>
                ) : (
                  <>
                    <th>SkySlope {activeParam.label}</th>
                    <th>BE {activeParam.label}</th>
                    <th>Result</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, i) => {
                const resultVal = row[currentKeys.result] ? row[currentKeys.result].toLowerCase() : '';
                const isMismatch = resultVal === 'mismatch';
                return (
                  <tr key={i} className={isMismatch ? 'mismatch' : ''}>
                    <td className="cell-guid">{row.saleGuid || '-'}</td>
                    <td className="cell-guid">{row.transactionId || '-'}</td>
                    <td className="cell-address">{row.property_address || '-'}</td>
                    {activeParam.id === 'reviewer_specialist' ? (
                      <>
                        <td className="cell-person">{row[currentKeys.skyslope] || '-'}</td>
                        <td className="cell-person">{row[currentKeys.be] || '-'}</td>
                      </>
                    ) : (
                      <>
                        <td>{row[currentKeys.skyslope] || 'null'}</td>
                        <td>{row[currentKeys.be] || 'null'}</td>
                        <td>
                          {resultVal ? (
                            <span className={`badge ${resultVal}`}>{resultVal}</span>
                          ) : '-'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={activeParam.id === 'reviewer_specialist' ? 5 : 6} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </button>
            <span style={{ fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
