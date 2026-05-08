import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { TXN_SPECIALIST_SUMMARY_API } from '../constants';
import { IconDownload } from '../components/Icons';

function TransactionSpecialistDashboardView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [uniqueStates, setUniqueStates] = useState([]);

    useEffect(() => {
        const STATE_API = TXN_SPECIALIST_SUMMARY_API.replace('/transaction_specialist_dashboard', '/transaction_specialist/state');
        fetch(STATE_API)
            .then(res => res.json())
            .then(json => {
                const states = Array.isArray(json) ? json : (json.data || []);
                setUniqueStates(states);
            })
            .catch(err => console.error('Failed to fetch states', err));
    }, []);

    useEffect(() => {
        setLoading(true);
        setError(null);
        let url = TXN_SPECIALIST_SUMMARY_API;
        const params = new URLSearchParams();
        if (dateFrom) params.append('from_date', dateFrom);
        if (dateTo) params.append('to_date', dateTo);
        if (stateFilter) params.append('state', stateFilter);
        const queryString = params.toString();
        if (queryString) {
            url += `?${queryString}`;
        }

        fetch(url)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => {
                const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setData(rows);
                setLoading(false);
            })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, [dateFrom, dateTo, stateFilter]);

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;
        const q = searchQuery.trim().toLowerCase();
        return data.filter(r => (r.transaction_specialist || '').toLowerCase().includes(q));
    }, [data, searchQuery]);

    const totals = useMemo(() => {
        const outstanding = data.reduce((sum, r) => sum + (r.transactions_outstanding || 0), 0);
        const closed = data.reduce((sum, r) => sum + (r.transactions_closed || 0), 0);
        return { specialists: data.length, outstanding, closed, total: outstanding + closed };
    }, [data]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Specialist Summary');
        writeFile(wb, 'Transaction_Specialist_Summary.xlsx');
    };

    // Find max value for bar scaling
    const maxVal = useMemo(() => {
        return Math.max(1, ...data.map(r => Math.max(r.transactions_outstanding || 0, r.transactions_closed || 0)));
    }, [data]);

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1>Transaction Specialist Dashboard</h1>
                    <p>Summary of transaction specialists — outstanding vs closed transactions.</p>
                </div>
                <button className="export-btn" onClick={handleDownload} disabled={!data.length}>
                    <IconDownload /> Download Report
                </button>
            </div>

            <div className="table-container">
                <div className="table-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2>Specialist Breakdown</h2>
                        {data.length > 0 && (
                            <span className="record-count-badge">{filteredData.length} of {data.length} specialists</span>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper" style={{ flex: 1 }}>
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="specialist-dash-search" type="text" className="search-input"
                            placeholder="Search by specialist name…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">✕</button>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="txn-filters-grid">
                    <div className="filter-group">
                        <label htmlFor="txn-dash-date-from" className="filter-label">Close Date From</label>
                        <input
                            id="txn-dash-date-from" type="date" className="filter-select"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="txn-dash-date-to" className="filter-label">Close Date To</label>
                        <input
                            id="txn-dash-date-to" type="date" className="filter-select"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="txn-dash-state-filter" className="filter-label">State</label>
                        <select
                            id="txn-dash-state-filter" className="filter-select"
                            value={stateFilter}
                            onChange={e => setStateFilter(e.target.value)}
                        >
                            <option value="">All States</option>
                            {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {(dateFrom || dateTo || stateFilter) && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                            <button className="clear-all-btn" onClick={() => { setDateFrom(''); setDateTo(''); setStateFilter(''); }}>Clear Filters</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div><p>Loading specialist summary…</p></div>
                ) : error ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                        <p>⚠️ Failed to load data: {error}</p>
                    </div>
                ) : (
                    <>
                        <div className="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>#</th>
                                        <th>Transaction Specialist</th>
                                        <th style={{ width: '160px' }}>Outstanding</th>
                                        <th style={{ width: '160px' }}>Closed</th>
                                        <th style={{ width: '120px' }}>Total</th>
                                        <th style={{ minWidth: '220px' }}>Distribution</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((row, i) => {
                                        const outstanding = row.transactions_outstanding || 0;
                                        const closed = row.transactions_closed || 0;
                                        const total = outstanding + closed;
                                        const outPct = total > 0 ? (outstanding / total * 100).toFixed(0) : 0;
                                        const closedPct = total > 0 ? (closed / total * 100).toFixed(0) : 0;
                                        return (
                                            <tr key={i}>
                                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                                                <td style={{ fontWeight: 600 }}>{row.transaction_specialist || '-'}</td>
                                                <td>
                                                    <span className="badge warning" style={{ minWidth: '36px', textAlign: 'center' }}>{outstanding}</span>
                                                </td>
                                                <td>
                                                    <span className="badge match" style={{ minWidth: '36px', textAlign: 'center' }}>{closed}</span>
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{total}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{
                                                            display: 'flex', height: '22px', borderRadius: '6px',
                                                            overflow: 'hidden', flex: 1, minWidth: '120px',
                                                            background: 'var(--bg-secondary)'
                                                        }}>
                                                            {outstanding > 0 && (
                                                                <div style={{
                                                                    width: `${outPct}%`, background: '#ef4444',
                                                                    transition: 'width 0.6s ease'
                                                                }} title={`Outstanding: ${outstanding} (${outPct}%)`} />
                                                            )}
                                                            {closed > 0 && (
                                                                <div style={{
                                                                    width: `${closedPct}%`, background: '#3b82f6',
                                                                    transition: 'width 0.6s ease'
                                                                }} title={`Closed: ${closed} (${closedPct}%)`} />
                                                            )}
                                                        </div>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                            {closedPct}% closed
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredData.length === 0 && (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444', display: 'inline-block' }}></span>
                                Outstanding
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#3b82f6', display: 'inline-block' }}></span>
                                Closed
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default TransactionSpecialistDashboardView;
