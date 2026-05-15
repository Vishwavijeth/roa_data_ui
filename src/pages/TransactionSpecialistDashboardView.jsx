import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { TXN_SPECIALIST_SUMMARY_API } from '../constants';
import { IconDownload } from '../components/Icons';
import MultiSelect from '../components/MultiSelect';

// ── Sub-count color palette (within Outstanding) ──────────────────────────────
const SUB_COUNTS = [
    { key: 'open_count', label: 'Open', color: '#ef4444' }, // solid red
    { key: 'commission_verified_count', label: 'Commission Verified', color: '#f59e0b' }, // solid amber
    { key: 'cda_sent_count', label: 'CDA Sent', color: '#6366f1' }, // solid indigo
    { key: 'title_payment_received_count', label: 'Title Payment Received', color: '#14b8a6' }, // solid teal
];

// ── Tooltip shown on hovering the Outstanding badge ───────────────────────────
function OutstandingTooltip({ row }) {
    return (
        <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
            padding: '0.85rem 1rem',
            minWidth: '220px',
            pointerEvents: 'none',
            animation: 'fadeIn 0.15s ease',
        }}>
            {/* Arrow pointing up */}
            <div style={{
                position: 'absolute',
                top: '-7px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '12px', height: '12px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                borderLeft: '1px solid #e2e8f0',
            }} />

            <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#64748b' }}>
                Outstanding Breakdown
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {SUB_COUNTS.map(({ key, label, color }) => {
                    const count = row[key] || 0;
                    return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span style={{
                                    width: '10px', height: '10px', borderRadius: '3px',
                                    background: color, flexShrink: 0, display: 'inline-block',
                                }} />
                                <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{label}</span>
                            </div>
                            <span style={{
                                fontSize: '0.88rem', fontWeight: 700,
                                color: count > 0 ? '#111827' : '#9ca3af',
                                fontVariantNumeric: 'tabular-nums',
                                minWidth: '24px', textAlign: 'right',
                            }}>
                                {count}
                            </span>
                        </div>
                    );
                })}
            </div>
            {/* Total line */}
            <div style={{
                marginTop: '0.6rem', paddingTop: '0.6rem',
                borderTop: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>Total Outstanding</span>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                    {row.transactions_outstanding || 0}
                </span>
            </div>
        </div>
    );
}

function TransactionSpecialistDashboardView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stateFilter, setStateFilter] = useState([]); // multi-select → array
    const [uniqueStates, setUniqueStates] = useState([]);
    const [hoveredOutstanding, setHoveredOutstanding] = useState(null); // row index

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
        // Send single state to API; multi-state is handled client-side
        if (stateFilter.length === 1) params.append('state', stateFilter[0]);
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

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
        let result = data;
        // Client-side filter when multiple states are selected
        if (stateFilter.length > 1) {
            result = result.filter(r => stateFilter.includes(r.state));
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(r => (r.transaction_specialist || '').toLowerCase().includes(q));
        }
        return result;
    }, [data, searchQuery, stateFilter]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Specialist Summary');
        writeFile(wb, 'Transaction_Specialist_Summary.xlsx');
    };

    const hasActiveFilters = dateFrom || dateTo || stateFilter.length > 0 || searchQuery;

    const clearAllFilters = () => {
        setDateFrom('');
        setDateTo('');
        setStateFilter([]);
        setSearchQuery('');
    };

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
                        <label className="filter-label">State</label>
                        <MultiSelect
                            id="txn-dash-state-filter"
                            options={uniqueStates}
                            selected={stateFilter}
                            onChange={v => setStateFilter(v)}
                            placeholder="All States"
                            allLabel="All States"
                        />
                    </div>
                    {hasActiveFilters && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                            <button className="clear-all-btn" onClick={clearAllFilters}>Clear Filters</button>
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
                                        <th style={{ width: '160px' }}>
                                            Outstanding
                                            <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 400, color: 'var(--text-muted)', marginTop: '2px' }}>hover for breakdown</span>
                                        </th>
                                        <th style={{ width: '160px' }}>Closed</th>
                                        <th style={{ width: '120px' }}>Total</th>
                                        <th style={{ minWidth: '280px' }}>Distribution</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((row, i) => {
                                        const outstanding = row.transactions_outstanding || 0;
                                        const closed = row.transactions_closed || 0;
                                        const total = outstanding + closed || 1;

                                        // Sub-counts for distribution bar
                                        const openCount = row.open_count || 0;
                                        const commissionCount = row.commission_verified_count || 0;
                                        const cdaCount = row.cda_sent_count || 0;
                                        const titleCount = row.title_payment_received_count || 0;

                                        const openPct = (openCount / total * 100).toFixed(1);
                                        const commissionPct = (commissionCount / total * 100).toFixed(1);
                                        const cdaPct = (cdaCount / total * 100).toFixed(1);
                                        const titlePct = (titleCount / total * 100).toFixed(1);
                                        const closedPct = (closed / total * 100).toFixed(1);
                                        const outstandingPct = (outstanding / total * 100).toFixed(0);

                                        return (
                                            <tr key={i}>
                                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                                                <td style={{ fontWeight: 600 }}>{row.transaction_specialist || '-'}</td>

                                                {/* Outstanding badge with hover tooltip */}
                                                <td>
                                                    <div
                                                        style={{ position: 'relative', display: 'inline-block' }}
                                                        onMouseEnter={() => setHoveredOutstanding(i)}
                                                        onMouseLeave={() => setHoveredOutstanding(null)}
                                                    >
                                                        <span
                                                            className="badge warning"
                                                            style={{
                                                                minWidth: '36px', textAlign: 'center',
                                                                cursor: 'default',
                                                                outline: hoveredOutstanding === i ? '2px solid #f97316' : 'none',
                                                                outlineOffset: '2px',
                                                                transition: 'outline 0.15s ease',
                                                            }}
                                                        >
                                                            {outstanding}
                                                        </span>
                                                        {hoveredOutstanding === i && <OutstandingTooltip row={row} />}
                                                    </div>
                                                </td>

                                                <td>
                                                    <span className="badge match" style={{ minWidth: '36px', textAlign: 'center' }}>{closed}</span>
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{outstanding + closed}</td>

                                                {/* Distribution bar — 4 outstanding sub-segments + closed */}
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{
                                                            display: 'flex', height: '22px', borderRadius: '6px',
                                                            overflow: 'hidden', flex: 1, minWidth: '160px',
                                                            background: 'var(--bg-secondary)',
                                                        }}>
                                                            {openCount > 0 && (
                                                                <div style={{ width: `${openPct}%`, background: '#f97316', transition: 'width 0.6s ease', flexShrink: 0 }}
                                                                    title={`Open: ${openCount} (${openPct}%)`} />
                                                            )}
                                                            {commissionCount > 0 && (
                                                                <div style={{ width: `${commissionPct}%`, background: '#eab308', transition: 'width 0.6s ease', flexShrink: 0 }}
                                                                    title={`Commission Verified: ${commissionCount} (${commissionPct}%)`} />
                                                            )}
                                                            {cdaCount > 0 && (
                                                                <div style={{ width: `${cdaPct}%`, background: '#8b5cf6', transition: 'width 0.6s ease', flexShrink: 0 }}
                                                                    title={`CDA Sent: ${cdaCount} (${cdaPct}%)`} />
                                                            )}
                                                            {titleCount > 0 && (
                                                                <div style={{ width: `${titlePct}%`, background: '#10b981', transition: 'width 0.6s ease', flexShrink: 0 }}
                                                                    title={`Title Payment Received: ${titleCount} (${titlePct}%)`} />
                                                            )}
                                                            {closed > 0 && (
                                                                <div style={{ width: `${closedPct}%`, background: '#3b82f6', transition: 'width 0.6s ease', flexShrink: 0 }}
                                                                    title={`Closed: ${closed} (${closedPct}%)`} />
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
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem 1.5rem', padding: '1rem 1.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', alignSelf: 'center', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Outstanding:</span>
                            {SUB_COUNTS.map(({ label, color }) => (
                                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, display: 'inline-block', flexShrink: 0 }}></span>
                                    {label}
                                </span>
                            ))}
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }}></span>
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
