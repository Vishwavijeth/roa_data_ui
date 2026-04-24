import React, { useState, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';

// ── Parameter definitions ─────────────────────────────────────────────────────
const PARAMETERS = [
    { id: 'saleprice', label: 'Sale Price', endpoint: 'sale_price', skyslopeKey: 'skyslope_sale_price', beKey: 'be_sale_price' },
    { id: 'status', label: 'Status', endpoint: 'status', apiBase: 'https://roa-data-backend-neon.vercel.app/comparison', skyslopeKey: 'skyslope_status', beKey: 'be_status' },
    { id: 'close_date', label: 'Close Date', endpoint: 'close_date', skyslopeKey: 'skyslope_close_date', beKey: 'be_close_date' },
    { id: 'listingprice', label: 'Listing Price', endpoint: 'listing_price', skyslopeKey: 'skyslope_listing_price', beKey: 'be_listing_price' },
    { id: 'contract_date', label: 'Contract Date', endpoint: 'contract_date', skyslopeKey: 'skyslope_contract_date', beKey: 'be_contract_date' },
    { id: 'buyer_name', label: 'Buyer Name', endpoint: 'buyer_name', apiBase: 'https://roa-data-backend-neon.vercel.app/comparison', skyslopeKey: 'skyslope_buyer_name', beKey: 'be_buyer_name' },
    { id: 'seller_name', label: 'Seller Name', endpoint: 'seller_name', apiBase: 'https://roa-data-backend-neon.vercel.app/comparison', skyslopeKey: 'skyslope_seller_name', beKey: 'be_seller_name' },
    { id: 'buying_agent_name', label: 'Buying Agent Name', endpoint: 'buying_agent_name', apiBase: 'https://roa-data-backend-neon.vercel.app/comparison', skyslopeKey: 'skyslope_buying_agent_name', beKey: 'be_buying_agent_name' },
    { id: 'gross_commission', label: 'Gross Commission', endpoint: 'gross_commission', skyslopeKey: 'skyslope_gross_commission', beKey: 'be_gross_commission' },
    { id: 'reviewer_specialist', label: 'Reviewer & Specialist', endpoint: 'transaction_reviewer_mapping', skyslopeKey: 'skyslope_reviewer_name', beKey: 'be_transaction_specialist' },
];

const API_BASE = 'https://roa-data-backend-neon.vercel.app/compare';
const ROWS_PER_PAGE = 50;

const getResult = (row) => {
    const v = row.match_result;
    if (!v || v === 'null') return '';
    return v.toLowerCase();
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IconDashboard = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" />
        <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" />
        <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" />
        <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" />
    </svg>
);
const IconBrokerage = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            d="M9 12h6M9 16h6M9 8h6M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
    </svg>
);
const IconSkySlope = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <ellipse cx="12" cy="6" rx="9" ry="3" strokeWidth="2" />
        <path strokeWidth="2" d="M3 6v6c0 1.657 4.03 3 9 3s9-1.343 9-3V6" />
        <path strokeWidth="2" d="M3 12v6c0 1.657 4.03 3 9 3s9-1.343 9-3v-6" />
    </svg>
);
const IconChevron = () => (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
    </svg>
);
const IconLogout = () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);
const IconDownload = () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);
const IconSpecialist = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
const IconReviewer = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
);
const IconSpecialistDash = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);
const IconReviewerDash = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4" />
    </svg>
);

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ activePage, setActivePage, onLogout }) {
    const navSections = [
        {
            label: 'GENERAL',
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
            ],
        },
        {
            label: 'RECONCILIATION',
            items: [
                { id: 'brokerage', label: 'Brokerage Engine', icon: <IconBrokerage /> },
                { id: 'skyslope', label: 'SkySlope Data', icon: <IconSkySlope /> },
            ],
        },
        {
            label: 'TRANSACTION SPECIALIST & REVIEWER',
            items: [
                { id: 'txn_specialist', label: 'Transaction Specialist listing', icon: <IconSpecialist /> },
                { id: 'reviewer', label: 'Reviewer listing', icon: <IconReviewer /> },
            ],
        },
        {
            label: 'DASHBOARDS',
            items: [
                { id: 'txn_specialist_dash', label: 'Transaction Specialist Dashboard', icon: <IconSpecialistDash /> },
                { id: 'reviewer_dash', label: 'Reviewer Dashboard', icon: <IconReviewerDash /> },
            ],
        },
    ];

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <img
                    src="https://dataportal.realtyofamerica.com/roa-logo.png"
                    alt="ROA Logo"
                    style={{ height: '36px', objectFit: 'contain' }}
                />
            </div>

            {/* Nav sections */}
            <nav className="sidebar-nav">
                {navSections.map(section => (
                    <div key={section.label} className="nav-section">
                        <span className="nav-section-label">{section.label}</span>
                        {section.items.map(item => (
                            <button
                                key={item.id}
                                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                                onClick={() => setActivePage(item.id)}
                            >
                                <span className="nav-item-icon">{item.icon}</span>
                                <span className="nav-item-label">{item.label}</span>
                                {activePage === item.id && (
                                    <span className="nav-item-chevron"><IconChevron /></span>
                                )}
                            </button>
                        ))}
                    </div>
                ))}
            </nav>

            {/* Logout */}
            <div className="sidebar-footer">
                <button className="sidebar-logout-btn" onClick={onLogout}>
                    <IconLogout />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}

// ── Reconciliation View (Dashboard page) ──────────────────────────────────────
function ReconciliationView() {
    const [activeParam, setActiveParam] = useState(PARAMETERS[0]);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [showOnlyMismatches, setShowOnlyMismatches] = useState(false);
    const [showNoSkyslope, setShowNoSkyslope] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [apiMismatchCount, setApiMismatchCount] = useState(null);

    useEffect(() => {
        if (!activeParam.endpoint) { setData([]); return; }
        setLoading(true);
        setError(null);
        setData([]);
        setApiMismatchCount(null);
        setPage(1);

        fetch(`${activeParam.apiBase || API_BASE}/${activeParam.endpoint}`)
            .then(res => {
                if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                // Handle both { mismatch_count, data: [...] } and flat array responses
                if (json && Array.isArray(json.data)) {
                    setData(json.data);
                    setApiMismatchCount(json.mismatch_count ?? null);
                } else if (Array.isArray(json)) {
                    setData(json);
                    setApiMismatchCount(null);
                } else {
                    setData([]);
                    setApiMismatchCount(null);
                }
                setLoading(false);
            })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, [activeParam]);

    const stats = useMemo(() => {
        if (!data.length) return { total: 0, matchPct: 0, mismatchPct: 0, mismatchCount: 0, noSkyslopeCount: 0, noSkysloppePct: 0 };
        const withResult = data.filter(r => getResult(r) !== '');
        const noSkyslope = withResult.filter(r => getResult(r) === 'no_skyslope_record').length;
        const matches = withResult.filter(r => getResult(r) === 'match').length;
        const mismatches = apiMismatchCount != null ? apiMismatchCount : withResult.filter(r => getResult(r) === 'mismatch').length;
        // Base for percentages: only match + mismatch (exclude no_skyslope_record)
        const comparedBase = matches + mismatches || 1;
        return {
            total: data.length,
            matchPct: ((matches / comparedBase) * 100).toFixed(1),
            mismatchPct: ((mismatches / comparedBase) * 100).toFixed(1),
            mismatchCount: mismatches,
            noSkyslopeCount: noSkyslope,
            noSkysloppePct: ((noSkyslope / (withResult.length || 1)) * 100).toFixed(1),
        };
    }, [data, apiMismatchCount]);

    const filteredData = useMemo(() => {
        let result = data;
        if (showOnlyMismatches) result = result.filter(r => getResult(r) === 'mismatch');
        if (showNoSkyslope) result = result.filter(r => getResult(r) === 'no_skyslope_record');
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(r =>
                (r.transactionId || r.transactionid || '').toLowerCase().includes(q) ||
                (r.saleguid || '').toLowerCase().includes(q) ||
                (r.propertyaddress || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [data, showOnlyMismatches, showNoSkyslope, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE;
        return filteredData.slice(start, start + ROWS_PER_PAGE);
    }, [filteredData, page]);

    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            // Fetch all parameter data in parallel
            const results = await Promise.all(
                PARAMETERS.map(async (param) => {
                    try {
                        const res = await fetch(`${param.apiBase || API_BASE}/${param.endpoint}`);
                        if (!res.ok) return { param, data: [] };
                        const json = await res.json();
                        const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                        return { param, data: rows };
                    } catch {
                        return { param, data: [] };
                    }
                })
            );

            // Build a map keyed by saleguid, merging all parameter columns
            const mergedMap = new Map();
            results.forEach(({ param, data: rows }) => {
                rows.forEach(row => {
                    const key = row.saleguid || row.transactionId || row.transactionid || '';
                    if (!key) return;
                    if (!mergedMap.has(key)) {
                        mergedMap.set(key, {
                            saleguid: row.saleguid || '',
                            transactionId: row.transactionId || row.transactionid || '',
                            propertyaddress: row.propertyaddress || '',
                        });
                    }
                    const entry = mergedMap.get(key);
                    // Use the property address from any row that has it
                    if (!entry.propertyaddress && row.propertyaddress) entry.propertyaddress = row.propertyaddress;
                    entry[`SS_${param.label}`] = row[param.skyslopeKey] != null ? String(row[param.skyslopeKey]) : '';
                    entry[`BE_${param.label}`] = row[param.beKey] != null ? String(row[param.beKey]) : '';
                    entry[`Result_${param.label}`] = row.match_result || '';
                });
            });

            const exportData = Array.from(mergedMap.values());
            const ws = utils.json_to_sheet(exportData);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, 'Reconciliation Report');
            writeFile(wb, 'ROA_Full_Reconciliation_Report.xlsx');
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="dashboard">
            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1>Transaction Reconciliation</h1>
                    <p>Compare transaction data across Brokerage Engine and SkySlope.</p>
                </div>
                <button className="export-btn" onClick={handleDownload} disabled={downloading}>
                    <IconDownload /> {downloading ? 'Generating Report…' : 'Download Report'}
                </button>
            </div>

            {/* Metric cards */}
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
                <div className="metric-card">
                    <h3>No SkySlope File ID</h3>
                    <p className="value warning">{stats.noSkyslopeCount.toLocaleString()}</p>
                </div>
            </div>

            {/* Parameter chips */}
            <div className="parameters-section">
                <h2>Comparison Parameters</h2>
                <div className="chips-container">
                    {PARAMETERS.map(param => (
                        <button
                            key={param.id}
                            className={`chip ${activeParam.id === param.id ? 'active' : ''}`}
                            onClick={() => { setActiveParam(param); setShowOnlyMismatches(false); setShowNoSkyslope(false); setSearchQuery(''); setPage(1); }}
                        >
                            {param.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table card */}
            <div className="table-container">
                <div className="table-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2>{activeParam.label} Comparison</h2>
                        <div className="mismatch-toggle-group">
                            <button
                                className={`toggle-btn ${showOnlyMismatches ? 'active' : ''}`}
                                onClick={() => { setShowOnlyMismatches(!showOnlyMismatches); if (!showOnlyMismatches) setShowNoSkyslope(false); setPage(1); }}
                            >Mismatches</button>
                            <span className="mismatch-count-badge">{stats.mismatchCount}</span>
                        </div>
                        <div className="mismatch-toggle-group">
                            <button
                                className={`toggle-btn no-skyslope ${showNoSkyslope ? 'active' : ''}`}
                                onClick={() => { setShowNoSkyslope(!showNoSkyslope); if (!showNoSkyslope) setShowOnlyMismatches(false); setPage(1); }}
                            >No SkySlope File ID</button>
                            <span className="no-skyslope-count-badge">{stats.noSkyslopeCount}</span>
                        </div>
                        {(showOnlyMismatches || showNoSkyslope || searchQuery) && (
                            <button
                                className="clear-filters-btn"
                                onClick={() => { setShowOnlyMismatches(false); setShowNoSkyslope(false); setSearchQuery(''); setPage(1); }}
                            >✕ Clear Filters</button>
                        )}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Showing page {page} of {totalPages || 1}
                    </span>
                </div>

                {/* Search */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper">
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="table-search" type="text" className="search-input"
                            placeholder="Search by Transaction ID, Sale Guid, or Property Address…"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => { setSearchQuery(''); setPage(1); }} aria-label="Clear search">✕</button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading {activeParam.label} data…</p>
                    </div>
                ) : error ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                        <p>⚠️ Failed to load data: {error}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Make sure the API server is running at <code>{API_BASE}</code>
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Sale Guid</th>
                                        <th>Transaction ID</th>
                                        <th>Property Address</th>
                                        <th>SkySlope {activeParam.label}</th>
                                        <th>BE {activeParam.label}</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => {
                                        const resultVal = getResult(row);
                                        const isMismatch = resultVal === 'mismatch';
                                        const isNoSkyslope = resultVal === 'no_skyslope_record';
                                        const skVal = row[activeParam.skyslopeKey];
                                        const beVal = row[activeParam.beKey];
                                        return (
                                            <tr key={i} className={isMismatch ? 'mismatch' : isNoSkyslope ? 'no-skyslope' : ''}>
                                                <td className="cell-guid">{row.saleguid || '-'}</td>
                                                <td className="cell-guid">{row.transactionId || row.transactionid || '-'}</td>
                                                <td className="cell-address">{row.propertyaddress || '-'}</td>
                                                <td>{skVal != null ? String(skVal) : 'null'}</td>
                                                <td>{beVal != null ? String(beVal) : 'null'}</td>
                                                <td>
                                                    {resultVal
                                                        ? <span className={`badge ${resultVal}`}>{resultVal}</span>
                                                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {paginatedData.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                                <span style={{ fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Brokerage Engine View ─────────────────────────────────────────────────────
const BE_API = 'https://roa-data-backend-neon.vercel.app/brokerage_engine';

function BrokerageView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [closeDateFrom, setCloseDateFrom] = useState('');
    const [closeDateTo, setCloseDateTo] = useState('');
    const [contractDateFrom, setContractDateFrom] = useState('');
    const [contractDateTo, setContractDateTo] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch(BE_API)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => { setData(Array.isArray(json) ? json : []); setLoading(false); })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, []);

    const stats = useMemo(() => {
        if (!data.length) return { total: 0, complete: 0, withSpecialist: 0 };
        return {
            total: data.length,
            complete: data.filter(r => r.status === 'Complete').length,
            withSpecialist: data.filter(r => r.transaction_specialist).length,
        };
    }, [data]);

    const uniqueStatuses = useMemo(() => [...new Set(data.map(r => r.status).filter(Boolean))].sort(), [data]);

    const filteredData = useMemo(() => {
        let result = data;
        if (statusFilter) result = result.filter(r => r.status === statusFilter);
        if (closeDateFrom) result = result.filter(r => r.close_date && r.close_date >= closeDateFrom);
        if (closeDateTo) result = result.filter(r => r.close_date && r.close_date <= closeDateTo);
        if (contractDateFrom) result = result.filter(r => r.contract_date && r.contract_date >= contractDateFrom);
        if (contractDateTo) result = result.filter(r => r.contract_date && r.contract_date <= contractDateTo);
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(r =>
                (r.transactionid || '').toLowerCase().includes(q) ||
                (r.property_address || '').toLowerCase().includes(q) ||
                (r.buying_agent_name || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [data, statusFilter, closeDateFrom, closeDateTo, contractDateFrom, contractDateTo, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE;
        return filteredData.slice(start, start + ROWS_PER_PAGE);
    }, [filteredData, page]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Brokerage Engine');
        writeFile(wb, 'Brokerage_Engine_report.xlsx');
    };

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1>Brokerage Engine</h1>
                    <p>Transaction data sourced from Brokerage Engine.</p>
                </div>
                <button className="export-btn" onClick={handleDownload} disabled={!data.length}>
                    <IconDownload /> Download Report
                </button>
            </div>

            {/* Table card */}
            <div className="table-container">
                <div className="table-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2>Transactions</h2>
                        {data.length > 0 && (
                            <span className="record-count-badge">{filteredData.length.toLocaleString()} records</span>
                        )}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Showing page {page} of {totalPages || 1}
                    </span>
                </div>

                {/* Search + filter */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper">
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="be-search" type="text" className="search-input"
                            placeholder="Search by Transaction ID, Property Address, or Buying Agent…"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => { setSearchQuery(''); setPage(1); }} aria-label="Clear search">✕</button>
                        )}
                    </div>
                </div>

                {/* Date filters */}
                <div className="txn-filters-grid">
                    <div className="filter-group">
                        <label htmlFor="be-close-from" className="filter-label">Close Date From</label>
                        <input id="be-close-from" type="date" className="filter-select"
                            value={closeDateFrom} onChange={e => { setCloseDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="be-close-to" className="filter-label">Close Date To</label>
                        <input id="be-close-to" type="date" className="filter-select"
                            value={closeDateTo} onChange={e => { setCloseDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="be-contract-from" className="filter-label">Contract Date From</label>
                        <input id="be-contract-from" type="date" className="filter-select"
                            value={contractDateFrom} onChange={e => { setContractDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="be-contract-to" className="filter-label">Contract Date To</label>
                        <input id="be-contract-to" type="date" className="filter-select"
                            value={contractDateTo} onChange={e => { setContractDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="be-status-filter" className="filter-label">Status</label>
                        <select id="be-status-filter" className="filter-select"
                            value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                            <option value="">All Statuses</option>
                            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {(searchQuery || statusFilter || closeDateFrom || closeDateTo || contractDateFrom || contractDateTo) && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                            <button className="clear-all-btn" onClick={() => {
                                setSearchQuery(''); setStatusFilter(''); setCloseDateFrom(''); setCloseDateTo('');
                                setContractDateFrom(''); setContractDateTo(''); setPage(1);
                            }}>Clear All Filters</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div><p>Loading Brokerage Engine data…</p></div>
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
                                        <th>Transaction ID</th>
                                        <th>Property Address</th>
                                        <th>Buying Agent</th>
                                        <th>Sale Price</th>
                                        <th>Contract Date</th>
                                        <th>Close Date</th>
                                        <th>Transaction Specialist</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => (
                                        <tr key={i}>
                                            <td className="cell-guid">{row.transactionid || '-'}</td>
                                            <td className="cell-address">{row.property_address || '-'}</td>
                                            <td>{row.buying_agent_name || '-'}</td>
                                            <td>{row.sale_price != null ? `$${Number(row.sale_price).toLocaleString()}` : '-'}</td>
                                            <td>{row.contract_date || '-'}</td>
                                            <td>{row.close_date || '-'}</td>
                                            <td>{row.transaction_specialist || '-'}</td>
                                            <td>
                                                {row.status
                                                    ? <span className={`badge ${row.status.toLowerCase()}`}>{row.status}</span>
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedData.length === 0 && (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                                <span style={{ fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Placeholder pages ─────────────────────────────────────────────────────────
function ComingSoonPage({ title, description, icon }) {
    return (
        <div className="coming-soon-page">
            <div className="coming-soon-icon">{icon}</div>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="coming-soon-badge">Coming Soon</span>
        </div>
    );
}

// ── Helper: extract US state abbreviation from address ────────────────────────
function extractState(address) {
    if (!address) return '';
    // Match 2-letter state code before a zip code like ", TX 76111"
    const match = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
    return match ? match[1] : '';
}

// ── Transaction Specialist View ───────────────────────────────────────────────
const TXN_SPECIALIST_API = 'https://roa-data-backend-neon.vercel.app/compare/transaction_specialist_dashboard';

function TransactionSpecialistView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [ssStatusFilter, setSsStatusFilter] = useState('');
    const [specialistFilter, setSpecialistFilter] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch(TXN_SPECIALIST_API)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => {
                const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setData(rows);
                setLoading(false);
            })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, []);

    // Derive unique values for filters
    const uniqueStates = useMemo(() => {
        const states = data.map(r => extractState(r.propertyaddress)).filter(Boolean);
        return [...new Set(states)].sort();
    }, [data]);

    const uniqueSsStatuses = useMemo(() => {
        return [...new Set(data.map(r => r.ss_status).filter(Boolean))].sort();
    }, [data]);

    const uniqueSpecialists = useMemo(() => {
        return [...new Set(data.map(r => r.transaction_specialist).filter(Boolean))].sort();
    }, [data]);

    // Filtered data
    const filteredData = useMemo(() => {
        let result = data;

        // Date range filter on be_closed_date
        if (dateFrom) {
            result = result.filter(r => r.be_closed_date && r.be_closed_date >= dateFrom);
        }
        if (dateTo) {
            result = result.filter(r => r.be_closed_date && r.be_closed_date <= dateTo);
        }

        // State filter
        if (stateFilter) {
            result = result.filter(r => extractState(r.propertyaddress) === stateFilter);
        }

        // SS Status filter
        if (ssStatusFilter) {
            result = result.filter(r => r.ss_status === ssStatusFilter);
        }

        // Transaction specialist filter
        if (specialistFilter) {
            result = result.filter(r => r.transaction_specialist === specialistFilter);
        }

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(r =>
                (r.transactionid || '').toLowerCase().includes(q) ||
                (r.propertyaddress || '').toLowerCase().includes(q) ||
                (r.saleguid || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [data, dateFrom, dateTo, stateFilter, ssStatusFilter, specialistFilter, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE;
        return filteredData.slice(start, start + ROWS_PER_PAGE);
    }, [filteredData, page]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(filteredData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Transaction Specialist');
        writeFile(wb, 'Transaction_Specialist_report.xlsx');
    };

    const hasActiveFilters = searchQuery || dateFrom || dateTo || stateFilter || ssStatusFilter || specialistFilter;

    const clearAllFilters = () => {
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        setStateFilter('');
        setSsStatusFilter('');
        setSpecialistFilter('');
        setPage(1);
    };

    return (
        <div className="dashboard">
            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1>Transaction Specialist</h1>
                    <p>View and filter transaction specialist assignments and statuses.</p>
                </div>
                <button className="export-btn" onClick={handleDownload} disabled={!data.length}>
                    <IconDownload /> Download Report
                </button>
            </div>

            {/* Table */}
            <div className="table-container">
                <div className="table-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2>Transactions</h2>
                        {data.length > 0 && (
                            <span className="record-count-badge">{filteredData.length.toLocaleString()} records</span>
                        )}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Showing page {page} of {totalPages || 1}
                    </span>
                </div>

                {/* Search */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper" style={{ flex: 1 }}>
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="txn-search" type="text" className="search-input"
                            placeholder="Search by Transaction ID, Address, or Sale GUID…"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => { setSearchQuery(''); setPage(1); }} aria-label="Clear search">✕</button>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="txn-filters-grid">
                    <div className="filter-group">
                        <label htmlFor="txn-date-from" className="filter-label">Close Date From</label>
                        <input
                            id="txn-date-from" type="date" className="filter-select"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="txn-date-to" className="filter-label">Close Date To</label>
                        <input
                            id="txn-date-to" type="date" className="filter-select"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="txn-state-filter" className="filter-label">State</label>
                        <select
                            id="txn-state-filter" className="filter-select"
                            value={stateFilter}
                            onChange={e => { setStateFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All States</option>
                            {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="txn-ss-status-filter" className="filter-label">SS Status</label>
                        <select
                            id="txn-ss-status-filter" className="filter-select"
                            value={ssStatusFilter}
                            onChange={e => { setSsStatusFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Statuses</option>
                            {uniqueSsStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="txn-specialist-filter" className="filter-label">Transaction Specialist</label>
                        <select
                            id="txn-specialist-filter" className="filter-select"
                            value={specialistFilter}
                            onChange={e => { setSpecialistFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Specialists</option>
                            {uniqueSpecialists.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {hasActiveFilters && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                            <button className="clear-all-btn" onClick={clearAllFilters}>Clear All Filters</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div><p>Loading Transaction Specialist data…</p></div>
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
                                        <th>Transaction ID</th>
                                        <th>Property Address</th>
                                        <th>State</th>
                                        <th>Sale Price</th>
                                        <th>Listing Price</th>
                                        <th>Close Date</th>
                                        <th>SS Status</th>
                                        <th>Workflow Status</th>
                                        <th>Transaction Specialist</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => (
                                        <tr key={i}>
                                            <td className="cell-guid">{row.transactionid || '-'}</td>
                                            <td className="cell-address">{row.propertyaddress || '-'}</td>
                                            <td>{extractState(row.propertyaddress) || '-'}</td>
                                            <td>{row.be_sale_price != null ? `$${Number(row.be_sale_price).toLocaleString()}` : '-'}</td>
                                            <td>{row.listing_price != null ? `$${Number(row.listing_price).toLocaleString()}` : '-'}</td>
                                            <td>{row.be_closed_date || '-'}</td>
                                            <td>
                                                {row.ss_status
                                                    ? <span className={`badge ${row.ss_status.toLowerCase().replace(/[^a-z]/g, '-')}`}>{row.ss_status}</span>
                                                    : '-'}
                                            </td>
                                            <td>
                                                {row.be_workflow_status
                                                    ? <span className={`badge ${row.be_workflow_status.toLowerCase().replace(/[^a-z]/g, '-')}`}>{row.be_workflow_status}</span>
                                                    : '-'}
                                            </td>
                                            <td>{row.transaction_specialist || '-'}</td>
                                        </tr>
                                    ))}
                                    {paginatedData.length === 0 && (
                                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                                <span style={{ fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Reviewer Dashboard View ───────────────────────────────────────────────────
const REVIEWER_API = 'https://roa-data-backend-neon.vercel.app/compare/reviewer_dashboard';

function ReviewerDashboardView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [ssStatusFilter, setSsStatusFilter] = useState('');
    const [reviewerFilter, setReviewerFilter] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch(REVIEWER_API)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => {
                const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setData(rows);
                setLoading(false);
            })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, []);

    // Derive unique values for filters
    const uniqueStates = useMemo(() => {
        const states = data.map(r => extractState(r.propertyaddress)).filter(Boolean);
        return [...new Set(states)].sort();
    }, [data]);

    const uniqueSsStatuses = useMemo(() => {
        return [...new Set(data.map(r => r.ss_status).filter(Boolean))].sort();
    }, [data]);

    const uniqueReviewers = useMemo(() => {
        return [...new Set(data.map(r => r.reviewer_name).filter(Boolean))].sort();
    }, [data]);

    // Filtered data
    const filteredData = useMemo(() => {
        let result = data;

        if (dateFrom) {
            result = result.filter(r => r.escrow_close_date && r.escrow_close_date >= dateFrom);
        }
        if (dateTo) {
            result = result.filter(r => r.escrow_close_date && r.escrow_close_date <= dateTo);
        }
        if (stateFilter) {
            result = result.filter(r => extractState(r.propertyaddress) === stateFilter);
        }
        if (ssStatusFilter) {
            result = result.filter(r => r.ss_status === ssStatusFilter);
        }
        if (reviewerFilter) {
            result = result.filter(r => r.reviewer_name === reviewerFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(r =>
                (r.transactionid || '').toLowerCase().includes(q) ||
                (r.propertyaddress || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [data, dateFrom, dateTo, stateFilter, ssStatusFilter, reviewerFilter, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE;
        return filteredData.slice(start, start + ROWS_PER_PAGE);
    }, [filteredData, page]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(filteredData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Reviewer Dashboard');
        writeFile(wb, 'Reviewer_Dashboard_report.xlsx');
    };

    const hasActiveFilters = searchQuery || dateFrom || dateTo || stateFilter || ssStatusFilter || reviewerFilter;

    const clearAllFilters = () => {
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        setStateFilter('');
        setSsStatusFilter('');
        setReviewerFilter('');
        setPage(1);
    };

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1>Reviewer Dashboard</h1>
                    <p>View and filter reviewer assignments and transaction statuses.</p>
                </div>
                <button className="export-btn" onClick={handleDownload} disabled={!data.length}>
                    <IconDownload /> Download Report
                </button>
            </div>

            <div className="table-container">
                <div className="table-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2>Transactions</h2>
                        {data.length > 0 && (
                            <span className="record-count-badge">{filteredData.length.toLocaleString()} records</span>
                        )}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Showing page {page} of {totalPages || 1}
                    </span>
                </div>

                {/* Search */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper" style={{ flex: 1 }}>
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="rev-search" type="text" className="search-input"
                            placeholder="Search by Transaction ID or Property Address…"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => { setSearchQuery(''); setPage(1); }} aria-label="Clear search">✕</button>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="txn-filters-grid">
                    <div className="filter-group">
                        <label htmlFor="rev-date-from" className="filter-label">Escrow Close Date From</label>
                        <input
                            id="rev-date-from" type="date" className="filter-select"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="rev-date-to" className="filter-label">Escrow Close Date To</label>
                        <input
                            id="rev-date-to" type="date" className="filter-select"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="rev-state-filter" className="filter-label">State</label>
                        <select
                            id="rev-state-filter" className="filter-select"
                            value={stateFilter}
                            onChange={e => { setStateFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All States</option>
                            {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="rev-ss-status-filter" className="filter-label">SS Status</label>
                        <select
                            id="rev-ss-status-filter" className="filter-select"
                            value={ssStatusFilter}
                            onChange={e => { setSsStatusFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Statuses</option>
                            {uniqueSsStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="rev-reviewer-filter" className="filter-label">Reviewer</label>
                        <select
                            id="rev-reviewer-filter" className="filter-select"
                            value={reviewerFilter}
                            onChange={e => { setReviewerFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Reviewers</option>
                            {uniqueReviewers.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    {hasActiveFilters && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                            <button className="clear-all-btn" onClick={clearAllFilters}>Clear All Filters</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div><p>Loading Reviewer data…</p></div>
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
                                        <th>Transaction ID</th>
                                        <th>Property Address</th>
                                        <th>State</th>
                                        <th>Sale Price</th>
                                        <th>Listing Price</th>
                                        <th>Escrow Close Date</th>
                                        <th>SS Status</th>
                                        <th>Workflow Status</th>
                                        <th>Reviewer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => (
                                        <tr key={i}>
                                            <td className="cell-guid">{row.transactionid || '-'}</td>
                                            <td className="cell-address">{row.propertyaddress || '-'}</td>
                                            <td>{extractState(row.propertyaddress) || '-'}</td>
                                            <td>{row.sale_price != null ? `$${Number(row.sale_price).toLocaleString()}` : '-'}</td>
                                            <td>{row.listing_price != null ? `$${Number(row.listing_price).toLocaleString()}` : '-'}</td>
                                            <td>{row.escrow_close_date || '-'}</td>
                                            <td>
                                                {row.ss_status
                                                    ? <span className={`badge ${row.ss_status.toLowerCase().replace(/[^a-z]/g, '-')}`}>{row.ss_status}</span>
                                                    : '-'}
                                            </td>
                                            <td>
                                                {row.be_workflow_status
                                                    ? <span className={`badge ${row.be_workflow_status.toLowerCase().replace(/[^a-z]/g, '-')}`}>{row.be_workflow_status}</span>
                                                    : '-'}
                                            </td>
                                            <td>{row.reviewer_name || '-'}</td>
                                        </tr>
                                    ))}
                                    {paginatedData.length === 0 && (
                                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                                <span style={{ fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── SkySlope Data View ────────────────────────────────────────────────────────
const SS_API = 'https://roa-data-backend-neon.vercel.app/skyslope_api';

function SkySlopeView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [closeDateFrom, setCloseDateFrom] = useState('');
    const [closeDateTo, setCloseDateTo] = useState('');
    const [contractDateFrom, setContractDateFrom] = useState('');
    const [contractDateTo, setContractDateTo] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch(SS_API)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => { setData(Array.isArray(json) ? json : []); setLoading(false); })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, []);

    const uniqueStatuses = useMemo(() => [...new Set(data.map(r => r.status).filter(Boolean))].sort(), [data]);

    const filteredData = useMemo(() => {
        let result = data;
        if (statusFilter) result = result.filter(r => r.status === statusFilter);
        if (closeDateFrom) result = result.filter(r => r.close_date && r.close_date >= closeDateFrom);
        if (closeDateTo) result = result.filter(r => r.close_date && r.close_date <= closeDateTo);
        if (contractDateFrom) result = result.filter(r => r.contract_date && r.contract_date >= contractDateFrom);
        if (contractDateTo) result = result.filter(r => r.contract_date && r.contract_date <= contractDateTo);
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(r =>
                (r.saleguid || '').toLowerCase().includes(q) ||
                (r.buyer_name || '').toLowerCase().includes(q) ||
                (r.buyer_agent_name || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [data, statusFilter, closeDateFrom, closeDateTo, contractDateFrom, contractDateTo, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE;
        return filteredData.slice(start, start + ROWS_PER_PAGE);
    }, [filteredData, page]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'SkySlope Data');
        writeFile(wb, 'SkySlope_Data_report.xlsx');
    };

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1>SkySlope Data</h1>
                    <p>Transaction data sourced from SkySlope.</p>
                </div>
                <button className="export-btn" onClick={handleDownload} disabled={!data.length}>
                    <IconDownload /> Download Report
                </button>
            </div>

            <div className="table-container">
                <div className="table-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2>Transactions</h2>
                        {data.length > 0 && (
                            <span className="record-count-badge">{filteredData.length.toLocaleString()} records</span>
                        )}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Showing page {page} of {totalPages || 1}
                    </span>
                </div>

                {/* Search + filters */}
                <div className="search-filter-bar">
                    <div className="search-input-wrapper">
                        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            id="ss-search" type="text" className="search-input"
                            placeholder="Search by Sale GUID, Buyer Name, or Buyer Agent…"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => { setSearchQuery(''); setPage(1); }} aria-label="Clear search">✕</button>
                        )}
                    </div>
                </div>

                {/* Date filters */}
                <div className="txn-filters-grid">
                    <div className="filter-group">
                        <label htmlFor="ss-close-from" className="filter-label">Close Date From</label>
                        <input id="ss-close-from" type="date" className="filter-select"
                            value={closeDateFrom} onChange={e => { setCloseDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="ss-close-to" className="filter-label">Close Date To</label>
                        <input id="ss-close-to" type="date" className="filter-select"
                            value={closeDateTo} onChange={e => { setCloseDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="ss-contract-from" className="filter-label">Contract Date From</label>
                        <input id="ss-contract-from" type="date" className="filter-select"
                            value={contractDateFrom} onChange={e => { setContractDateFrom(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="ss-contract-to" className="filter-label">Contract Date To</label>
                        <input id="ss-contract-to" type="date" className="filter-select"
                            value={contractDateTo} onChange={e => { setContractDateTo(e.target.value); setPage(1); }}
                            style={{ backgroundImage: 'none' }} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="ss-status-filter" className="filter-label">Status</label>
                        <select id="ss-status-filter" className="filter-select" value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                            <option value="">All Statuses</option>
                            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {(searchQuery || statusFilter || closeDateFrom || closeDateTo || contractDateFrom || contractDateTo) && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                            <button className="clear-all-btn" onClick={() => {
                                setSearchQuery(''); setStatusFilter(''); setCloseDateFrom(''); setCloseDateTo('');
                                setContractDateFrom(''); setContractDateTo(''); setPage(1);
                            }}>Clear All Filters</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div><p>Loading SkySlope data…</p></div>
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
                                        <th>Sale GUID</th>
                                        <th>Buyer Name</th>
                                        <th>Buyer Agent</th>
                                        <th>Contract Date</th>
                                        <th>Close Date</th>
                                        <th>Reviewer</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => (
                                        <tr key={i}>
                                            <td className="cell-guid">{row.saleguid || '-'}</td>
                                            <td>{row.buyer_name || '-'}</td>
                                            <td>{row.buyer_agent_name || '-'}</td>
                                            <td>{row.contract_date || '-'}</td>
                                            <td>{row.close_date || '-'}</td>
                                            <td>{row.reviewer || '-'}</td>
                                            <td>
                                                {row.status
                                                    ? <span className={`badge ${row.status.toLowerCase().replace(/[^a-z]/g, '-')}`}>{row.status}</span>
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedData.length === 0 && (
                                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No data available</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                                <span style={{ fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Transaction Specialist Dashboard View ─────────────────────────────────────
const TXN_SPECIALIST_SUMMARY_API = 'https://roa-data-backend-neon.vercel.app/compare/transaction_specialist_summary';

function TransactionSpecialistDashView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch(TXN_SPECIALIST_SUMMARY_API)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => {
                const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setData(rows);
                setLoading(false);
            })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, []);

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

            {/* Summary metric cards */}
            <div className="metrics-container">
                <div className="metric-card">
                    <h3>Total Specialists</h3>
                    <p className="value">{totals.specialists}</p>
                </div>
                <div className="metric-card">
                    <h3>Total Transactions</h3>
                    <p className="value">{totals.total.toLocaleString()}</p>
                </div>
                <div className="metric-card">
                    <h3>Outstanding</h3>
                    <p className="value warning">{totals.outstanding.toLocaleString()}</p>
                </div>
                <div className="metric-card">
                    <h3>Closed</h3>
                    <p className="value success">{totals.closed.toLocaleString()}</p>
                </div>
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

// ── Reviewer Dashboard View ───────────────────────────────────────────────────
const REVIEWER_SUMMARY_API = 'https://roa-data-backend-neon.vercel.app/compare/reviewer_summary';

function ReviewerDashView() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch(REVIEWER_SUMMARY_API)
            .then(res => { if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`); return res.json(); })
            .then(json => {
                const rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setData(rows);
                setLoading(false);
            })
            .catch(err => { console.error(err); setError(err.message); setLoading(false); });
    }, []);

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;
        const q = searchQuery.trim().toLowerCase();
        return data.filter(r => (r.reviewer_full_name || '').toLowerCase().includes(q));
    }, [data, searchQuery]);

    const totals = useMemo(() => {
        const outstanding = data.reduce((sum, r) => sum + (r.transactions_outstanding || 0), 0);
        const closed = data.reduce((sum, r) => sum + (r.transactions_closed || 0), 0);
        return { reviewers: data.length, outstanding, closed, total: outstanding + closed };
    }, [data]);

    const handleDownload = () => {
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Reviewer Summary');
        writeFile(wb, 'Reviewer_Summary.xlsx');
    };

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1>Reviewer Dashboard</h1>
                    <p>Summary of reviewers — outstanding vs closed transactions.</p>
                </div>
                <button className="export-btn" onClick={handleDownload} disabled={!data.length}>
                    <IconDownload /> Download Report
                </button>
            </div>

            {/* Summary metric cards */}
            <div className="metrics-container">
                <div className="metric-card">
                    <h3>Total Reviewers</h3>
                    <p className="value">{totals.reviewers}</p>
                </div>
                <div className="metric-card">
                    <h3>Total Transactions</h3>
                    <p className="value">{totals.total.toLocaleString()}</p>
                </div>
                <div className="metric-card">
                    <h3>Outstanding</h3>
                    <p className="value warning">{totals.outstanding.toLocaleString()}</p>
                </div>
                <div className="metric-card">
                    <h3>Closed</h3>
                    <p className="value success">{totals.closed.toLocaleString()}</p>
                </div>
            </div>

            <div className="table-container">
                <div className="table-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2>Reviewer Breakdown</h2>
                        {data.length > 0 && (
                            <span className="record-count-badge">{filteredData.length} of {data.length} reviewers</span>
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
                            id="reviewer-dash-search" type="text" className="search-input"
                            placeholder="Search by reviewer name…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">✕</button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div><p>Loading reviewer summary…</p></div>
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
                                        <th>Reviewer</th>
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
                                                <td style={{ fontWeight: 600 }}>{row.reviewer_full_name || '-'}</td>
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

// ── Dashboard Shell (layout + sidebar) ───────────────────────────────────────
function Dashboard({ setIsAuthenticated }) {
    const [activePage, setActivePage] = useState('dashboard');

    const handleLogout = () => {
        sessionStorage.removeItem('roa_auth');
        setIsAuthenticated(false);
    };

    const renderPage = () => {
        switch (activePage) {
            case 'dashboard':
                return <ReconciliationView />;
            case 'brokerage':
                return <BrokerageView />;
            case 'skyslope':
                return <SkySlopeView />;
            case 'txn_specialist':
                return <TransactionSpecialistView />;
            case 'reviewer':
                return <ReviewerDashboardView />;
            case 'txn_specialist_dash':
                return <TransactionSpecialistDashView />;
            case 'reviewer_dash':
                return <ReviewerDashView />;
            default:
                return <ReconciliationView />;
        }
    };

    return (
        <div className="app-layout">
            <Sidebar activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout} />
            <main className="main-content">
                {renderPage()}
            </main>
        </div>
    );
}

export default Dashboard;