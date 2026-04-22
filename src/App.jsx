import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { utils, writeFile } from 'xlsx';
import './App.css';

const PARAMETERS = [
  { id: 'saleprice', label: 'Sale Price' },
  { id: 'close_date', label: 'Close Date' },
  { id: 'listingprice', label: 'Listing Price' },
  { id: 'contract_date', label: 'Contract Date' },
  { id: 'listingguid', label: 'Listing Guid' },
  { id: 'buyer_name', label: 'Buyer Name' },
  { id: 'seller_name', label: 'Seller Name' }
];

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeParam, setActiveParam] = useState(PARAMETERS[0]);
  const [page, setPage] = useState(1);
  const [showOnlyMismatches, setShowOnlyMismatches] = useState(false);

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
          if (row[resultKey].toLowerCase() === 'match') {
            matchFields++;
          }
        }
      });
    });

    const matchPct = totalFields ? ((matchFields / totalFields) * 100).toFixed(1) : 0;
    const mismatchPct = totalFields ? (((totalFields - matchFields) / totalFields) * 100).toFixed(1) : 0;

    return {
      total: data.length,
      matchPct,
      mismatchPct
    };
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
      default: return { skyslope: '', be: '', result: '' };
    }
  };

  const currentKeys = getRowKeys(activeParam);

  const filteredData = useMemo(() => {
    if (!showOnlyMismatches) return data;
    return data.filter(row => {
      const resultVal = row[currentKeys.result] ? row[currentKeys.result].toLowerCase() : '';
      return resultVal === 'mismatch';
    });
  }, [data, showOnlyMismatches, currentKeys]);

  const mismatchCount = useMemo(() => {
    return data.filter((row) => {
      const resultVal = row[currentKeys.result]
        ? row[currentKeys.result].toLowerCase()
        : '';
      return resultVal === 'mismatch';
    }).length;
  }, [data, currentKeys]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading Data...</p>
      </div>
    );
  }

  const handleDownload = () => {
    const worksheet = utils.json_to_sheet(data);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Master Report");

    const fileName = `ROA master report.xlsx`;
    writeFile(workbook, fileName);
  };

  return (
    <div className="dashboard">
      <header className="header-actions">
        <div>
          <h1>ROA</h1>
          <p>Transaction reconciliation overview across Brokerage Engine and SkySlope.</p>
        </div>
        <button className="export-btn" onClick={handleDownload}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Master Report
        </button>
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
              onClick={() => {
                setActiveParam(param);
                setPage(1);
              }}
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
                onClick={() => {
                  setShowOnlyMismatches(!showOnlyMismatches);
                  setPage(1);
                }}
              >
                Show Only Mismatches
              </button>

              <span className="mismatch-count-badge">{mismatchCount}</span>
            </div>
          </div>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Showing page {page} of {totalPages || 1}</span>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Sale Guid</th>
                <th>Transaction ID</th>
                <th>SkySlope {activeParam.label}</th>
                <th>BE {activeParam.label}</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, i) => {
                const resultVal = row[currentKeys.result] ? row[currentKeys.result].toLowerCase() : '';
                const isMismatch = resultVal === 'mismatch';

                return (
                  <tr key={i} className={isMismatch ? 'mismatch' : ''}>
                    <td>{row.saleGuid || '-'}</td>
                    <td>{row.transactionId || '-'}</td>
                    <td>{row[currentKeys.skyslope] || 'null'}</td>
                    <td>{row[currentKeys.be] || 'null'}</td>
                    <td>
                      {resultVal ? (
                        <span className={`badge ${resultVal}`}>
                          {resultVal}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
